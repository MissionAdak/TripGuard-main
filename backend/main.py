from copy import deepcopy
from uuid import uuid4
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from engine.graph import propagate_disruption
from engine.recovery import apply_plan, generate_recovery_plans
from engine.predictive_risk import (
    calculate_itinerary_predictive_risk,
    calculate_segment_risk,
)
from engine.resilience import calculate_itinerary_resilience
from engine.importer import parse_imported_booking
from engine.claim_evidence import generate_claim_evidence_bundle
from engine.traveler_learning import (
    get_traveler_profile,
    reset_traveler_preferences,
)
from geocode import geocode_location
from mock_data import get_mock_itinerary
from models import (
    BookingImportRequest,
    ClaimEvidenceBundle,
    Dependency,
    DependencyType,
    DisruptionEvent,
    GeocodeResult,
    GroupInfo,
    ImportedBookingResult,
    Itinerary,
    ItineraryCreate,
    ItineraryPredictiveRisk,
    ItinerarySummary,
    RecoveryResponse,
    ResilienceAnalysis,
    RiskState,
    Segment,
    TravelerPreferenceProfile,
)

app = FastAPI(title="TRIPGUARD API - Predictive Resilience Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_itineraries: dict[str, Itinerary] = {}
original_itineraries: dict[str, Itinerary] = {}
last_delay_minutes: dict[str, int] = {}


def _attach_coords(segment: Segment) -> Segment:
    if segment.location_start and (segment.start_lat is None or segment.start_lng is None):
        coords = geocode_location(segment.location_start)
        if coords:
            segment.start_lat, segment.start_lng = coords
    if segment.location_end and (segment.end_lat is None or segment.end_lng is None):
        coords = geocode_location(segment.location_end)
        if coords:
            segment.end_lat, segment.end_lng = coords
    if segment.end_lat is None and segment.start_lat is not None:
        segment.end_lat, segment.end_lng = segment.start_lat, segment.start_lng
    return segment


def _decorate_scores(itinerary: Itinerary) -> Itinerary:
    pred = calculate_itinerary_predictive_risk(itinerary)
    res = calculate_itinerary_resilience(itinerary)
    itinerary.predictive_risk_score = pred.overall_risk_score
    itinerary.resilience_score = res.resilience_score
    for seg in itinerary.segments:
        seg_risk = calculate_segment_risk(seg)
        seg.predictive_risk_score = seg_risk.risk_score
        seg.historical_delay_rate = seg_risk.historical_delay_rate
        seg.vendor_reliability_score = seg_risk.vendor_reliability
    return itinerary


def _summary(itinerary: Itinerary) -> ItinerarySummary:
    statuses = [s.status for s in itinerary.segments]
    worst = RiskState.SAFE
    rank = {
        RiskState.SAFE: 0,
        RiskState.RECOVERED: 1,
        RiskState.AT_RISK: 2,
        RiskState.HIGH_RISK: 3,
        RiskState.DISRUPTED: 4,
    }
    for status in statuses:
        if rank[status] > rank[worst]:
            worst = status
    locations: list[str] = []
    for segment in itinerary.segments:
        for loc in (segment.location_start, segment.location_end):
            if loc and loc not in locations:
                locations.append(loc)
    starts = [s.start_time for s in itinerary.segments]
    ends = [s.end_time for s in itinerary.segments]
    return ItinerarySummary(
        id=itinerary.id,
        name=itinerary.name,
        traveler_name=itinerary.traveler_name,
        segment_count=len(itinerary.segments),
        status=worst,
        locations=locations,
        start_time=min(starts) if starts else None,
        end_time=max(ends) if ends else None,
        resilience_score=itinerary.resilience_score,
        predictive_risk_score=itinerary.predictive_risk_score,
        group_size=itinerary.group_info.party_size if itinerary.group_info else 1,
    )


def _build_itinerary(payload: ItineraryCreate, itin_id: str | None = None) -> Itinerary:
    if not payload.segments:
        raise HTTPException(status_code=400, detail="Add at least one trip segment")

    itin_id = itin_id or f"ITIN-{uuid4().hex[:6].upper()}"
    ordered = sorted(payload.segments, key=lambda s: s.start_time)
    segments: list[Segment] = []
    for index, item in enumerate(ordered, start=1):
        segment = Segment(
            id=f"{itin_id}-seg-{index}",
            itinerary_id=itin_id,
            type=item.type,
            name=item.name,
            description=item.description,
            start_time=item.start_time,
            end_time=item.end_time,
            location_start=item.location_start,
            location_end=item.location_end,
            cost=item.cost,
            vendor_name=item.vendor_name or item.name,
            vendor_source=item.vendor_source or "Manual",
            booking_reference=item.booking_reference or f"REF-{uuid4().hex[:6].upper()}",
        )
        segments.append(_attach_coords(segment))

    dependencies: list[Dependency] = []
    for index in range(len(segments) - 1):
        gap = int((segments[index + 1].start_time - segments[index].end_time).total_seconds() // 60)
        buffer = max(0, gap)
        dependencies.append(
            Dependency(
                id=f"{itin_id}-dep-{index + 1}",
                source_id=segments[index].id,
                target_id=segments[index + 1].id,
                type=DependencyType.SEQUENTIAL,
                buffer_minutes=buffer,
                max_tolerated_delay_minutes=max(60, buffer + 30),
            )
        )

    itin = Itinerary(
        id=itin_id,
        user_id=payload.user_id,
        traveler_name=payload.traveler_name,
        name=payload.name,
        segments=segments,
        dependencies=dependencies,
        group_info=payload.group_info or GroupInfo(party_size=1),
    )
    return _decorate_scores(itin)


@app.post("/api/simulate-data", response_model=Itinerary)
def simulate_data():
    demo = get_mock_itinerary()
    _decorate_scores(demo)
    active_itineraries[demo.id] = demo
    original_itineraries[demo.id] = deepcopy(demo)
    return demo


@app.post("/api/clear-data")
def clear_data():
    active_itineraries.clear()
    original_itineraries.clear()
    last_delay_minutes.clear()
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/itineraries", response_model=list[ItinerarySummary])
def list_itineraries():
    return [_summary(item) for item in active_itineraries.values()]


@app.post("/api/itineraries", response_model=Itinerary)
def create_itinerary(payload: ItineraryCreate):
    itinerary = _build_itinerary(payload)
    active_itineraries[itinerary.id] = itinerary
    original_itineraries[itinerary.id] = deepcopy(itinerary)
    return itinerary


@app.get("/api/itinerary/{itin_id}", response_model=Itinerary)
def get_itinerary(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return active_itineraries[itin_id]


@app.put("/api/itinerary/{itin_id}", response_model=Itinerary)
def update_itinerary(itin_id: str, payload: ItineraryCreate):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    itinerary = _build_itinerary(payload, itin_id=itin_id)
    existing = active_itineraries[itin_id]
    itinerary.user_id = existing.user_id
    if payload.group_info is None:
        itinerary.group_info = existing.group_info
    active_itineraries[itin_id] = itinerary
    original_itineraries[itin_id] = deepcopy(itinerary)
    last_delay_minutes.pop(itin_id, None)
    return itinerary


@app.delete("/api/itinerary/{itin_id}")
def delete_itinerary(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    del active_itineraries[itin_id]
    original_itineraries.pop(itin_id, None)
    last_delay_minutes.pop(itin_id, None)
    return {"ok": True}


@app.post("/api/itinerary/{itin_id}/disrupt", response_model=Itinerary)
def disrupt_itinerary(itin_id: str, event: DisruptionEvent):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    itinerary = deepcopy(original_itineraries.get(itin_id, active_itineraries[itin_id]))
    updated = propagate_disruption(itinerary, event.segment_id, event.delay_minutes)
    _decorate_scores(updated)
    active_itineraries[itin_id] = updated
    last_delay_minutes[itin_id] = event.delay_minutes
    return updated


@app.get("/api/itinerary/{itin_id}/recover", response_model=RecoveryResponse)
def get_recovery_plans(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    delay = last_delay_minutes.get(itin_id, 180)
    return generate_recovery_plans(active_itineraries[itin_id], delay)


@app.post("/api/itinerary/{itin_id}/apply-plan/{plan_id}", response_model=Itinerary)
def apply_recovery_plan(itin_id: str, plan_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    delay = last_delay_minutes.get(itin_id, 180)
    response = generate_recovery_plans(active_itineraries[itin_id], delay)
    selected = next((plan for plan in response.plans if plan.id == plan_id), None)
    if not selected:
        raise HTTPException(status_code=404, detail="Plan not found")
    updated = apply_plan(active_itineraries[itin_id], selected)
    for segment in updated.segments:
        _attach_coords(segment)
    _decorate_scores(updated)
    active_itineraries[itin_id] = updated
    return updated


@app.post("/api/itinerary/{itin_id}/reset", response_model=Itinerary)
def reset_itinerary(itin_id: str):
    if itin_id not in original_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    restored = deepcopy(original_itineraries[itin_id])
    _decorate_scores(restored)
    active_itineraries[itin_id] = restored
    last_delay_minutes.pop(itin_id, None)
    return restored


# Feature 1: Predictive Risk API
@app.get("/api/itinerary/{itin_id}/predictive-risk", response_model=ItineraryPredictiveRisk)
def get_predictive_risk(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return calculate_itinerary_predictive_risk(active_itineraries[itin_id])


# Feature 4: Resilience & Single Point of Failure (SPOF) API
@app.get("/api/itinerary/{itin_id}/resilience", response_model=ResilienceAnalysis)
def get_resilience(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return calculate_itinerary_resilience(active_itineraries[itin_id])


# Feature 3: Cross-Vendor External Booking Import API
@app.post("/api/itinerary/{itin_id}/import-booking", response_model=ImportedBookingResult)
def import_booking(itin_id: str, request: BookingImportRequest):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    itinerary = active_itineraries[itin_id]
    base_time = itinerary.segments[-1].end_time if itinerary.segments else None

    result = parse_imported_booking(request, itin_id, base_time=base_time)
    new_seg = result.parsed_segment

    # Insert segment into itinerary and re-sort
    itinerary.segments.append(new_seg)
    itinerary.segments.sort(key=lambda s: s.start_time)

    # Rebuild sequential dependencies
    dependencies: list[Dependency] = []
    for index in range(len(itinerary.segments) - 1):
        gap = int((itinerary.segments[index + 1].start_time - itinerary.segments[index].end_time).total_seconds() // 60)
        buffer = max(0, gap)
        dependencies.append(
            Dependency(
                id=f"{itin_id}-dep-{index + 1}",
                source_id=itinerary.segments[index].id,
                target_id=itinerary.segments[index + 1].id,
                type=DependencyType.SEQUENTIAL,
                buffer_minutes=buffer,
                max_tolerated_delay_minutes=max(60, buffer + 30),
            )
        )
    itinerary.dependencies = dependencies
    _decorate_scores(itinerary)
    original_itineraries[itin_id] = deepcopy(itinerary)

    return result


# Feature 6: AirHelp-Style Insurance Claim Evidence Bundle API
@app.get("/api/itinerary/{itin_id}/claim-evidence", response_model=ClaimEvidenceBundle)
def get_claim_evidence(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    delay = last_delay_minutes.get(itin_id, 180)
    return generate_claim_evidence_bundle(active_itineraries[itin_id], delay)


# Feature 5: Traveler Preference Profile API
@app.get("/api/traveler/preferences", response_model=TravelerPreferenceProfile)
def get_preferences(user_id: str = "guest", traveler_name: str = "Guest traveler"):
    return get_traveler_profile(user_id, traveler_name)


@app.post("/api/traveler/preferences/reset", response_model=TravelerPreferenceProfile)
def reset_preferences(user_id: str = "guest"):
    return reset_traveler_preferences(user_id)


# Feature 7: Group Update API
@app.put("/api/itinerary/{itin_id}/group", response_model=Itinerary)
def update_group(itin_id: str, group: GroupInfo):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    active_itineraries[itin_id].group_info = group
    original_itineraries[itin_id].group_info = deepcopy(group)
    return active_itineraries[itin_id]


@app.get("/api/geocode", response_model=GeocodeResult)
def geocode(q: str = Query(..., min_length=1)):
    coords = geocode_location(q)
    if not coords:
        return GeocodeResult(query=q)
    return GeocodeResult(query=q, lat=coords[0], lng=coords[1])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
