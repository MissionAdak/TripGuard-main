"""
Comprehensive Unit Tests for Advanced TripGuard Features.
"""

from datetime import datetime, timedelta
import pytest
from mock_data import get_mock_itinerary
from engine.predictive_risk import calculate_itinerary_predictive_risk, calculate_segment_risk
from engine.resilience import calculate_itinerary_resilience
from engine.net_cost import calculate_recovery_net_cost
from engine.importer import parse_imported_booking
from engine.traveler_learning import (
    get_traveler_profile,
    record_plan_choice,
    apply_personalized_scoring,
    reset_traveler_preferences,
)
from engine.claim_evidence import generate_claim_evidence_bundle
from engine.group_handling import evaluate_group_impact
from models import (
    BookingImportRequest,
    GroupInfo,
    GroupPartyMember,
    PlanScore,
    Segment,
    SegmentType,
)


def test_predictive_risk_scoring():
    itin = get_mock_itinerary()
    pred = calculate_itinerary_predictive_risk(itin)
    assert 0 <= pred.overall_risk_score <= 100
    assert pred.overall_risk_band in {"LOW", "MODERATE", "HIGH"}
    assert len(pred.segment_risks) == len(itin.segments)
    
    # Test formula components on segment 1 (BOM -> DEL flight)
    seg1_risk = calculate_segment_risk(itin.segments[0])
    assert seg1_risk.historical_delay_rate > 0
    assert seg1_risk.vendor_reliability > 0
    assert seg1_risk.risk_score > 0
    assert seg1_risk.weather_factor.location != ""


def test_structural_resilience_and_spofs():
    itin = get_mock_itinerary()
    res = calculate_itinerary_resilience(itin)
    assert 0 <= res.resilience_score <= 100
    assert res.resilience_rating in {"Robust", "Moderate", "Vulnerable"}
    # The mock itinerary has tight buffers (0 and 30 mins), so SPOFs should be identified
    assert res.spof_count >= 1
    assert len(res.spofs) >= 1
    assert "buffer" in res.spofs[0].recommendation.lower()


def test_true_net_cost_calculation():
    itin = get_mock_itinerary()
    disrupted = itin.segments[0]
    cheap_replacement = [
        Segment(
            id="cheap-1",
            itinerary_id=itin.id,
            type=SegmentType.FLIGHT,
            name="Indigo replacement",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=2),
            cost=90.0,
        )
    ]
    
    # net_cost = new_cost - refund_owed + cancellation_penalty - insurance_claimable
    ledger = calculate_recovery_net_cost("Cheapest", disrupted, cheap_replacement, delay_minutes=180)
    assert ledger.new_cost == 90.0
    assert ledger.refund_owed > 0
    assert ledger.insurance_claimable == 100.0  # flight delay >= 180 min
    expected_net = round(
        ledger.new_cost - ledger.refund_owed + ledger.cancellation_penalty - ledger.insurance_claimable, 2
    )
    assert ledger.net_out_of_pocket == expected_net
    assert len(ledger.breakdown_notes) >= 2


def test_cross_vendor_booking_importer():
    req = BookingImportRequest(template_preset="booking_hotel")
    result = parse_imported_booking(req, "ITIN-TEST")
    assert result.source_vendor == "Booking.com"
    assert result.parsed_segment.type == SegmentType.HOTEL
    assert result.booking_reference == "BK-99281"
    assert result.parsed_segment.cost == 180.0

    viator_req = BookingImportRequest(template_preset="viator_tour")
    v_res = parse_imported_booking(viator_req, "ITIN-TEST")
    assert v_res.source_vendor == "Viator"
    assert v_res.parsed_segment.type == SegmentType.ACTIVITY
    assert v_res.parsed_segment.cost == 45.0


def test_traveler_preference_learning():
    reset_traveler_preferences("test-traveler")
    profile = get_traveler_profile("test-traveler", "Alice")
    assert profile.choices_count["balanced"] == 0

    # Record 3 balanced plan choices
    record_plan_choice("test-traveler", "plan-balanced", "Balanced")
    record_plan_choice("test-traveler", "plan-balanced", "Balanced")
    record_plan_choice("test-traveler", "plan-balanced", "Balanced")

    updated_profile = get_traveler_profile("test-traveler", "Alice")
    assert updated_profile.dominant_preference == "Balanced"
    assert updated_profile.choices_count["balanced"] == 3

    base_score = PlanScore(cost=80, time=70, itinerary_preservation=85, convenience=75, traveler_preference=70, total=75)
    new_score, tag = apply_personalized_scoring("plan-balanced", "Balanced", base_score, updated_profile)
    assert new_score.traveler_preference > base_score.traveler_preference
    assert tag is not None
    assert "Personalized" in tag


def test_insurance_claim_evidence_bundle():
    itin = get_mock_itinerary()
    bundle = generate_claim_evidence_bundle(itin, delay_minutes=210)
    assert bundle.claim_id.startswith("CLM-2026-")
    assert bundle.verification_hash.startswith("TG-")
    assert bundle.delay_duration_minutes == 210
    assert len(bundle.applicable_regulations) >= 1
    assert "DGCA" in bundle.applicable_regulations[0].regulation_code
    assert len(bundle.itemized_losses) >= 1
    assert "OFFICIAL TRIPGUARD DISRUPTION CERTIFICATE" in bundle.carrier_delay_certificate


def test_group_trip_handling():
    group = GroupInfo(
        is_group=True,
        party_size=4,
        members=[GroupPartyMember(id=f"m{i}", name=f"Member {i}") for i in range(4)],
    )
    itin = get_mock_itinerary()
    fast_impact = evaluate_group_impact("Fastest", [itin.segments[0]], group)
    assert fast_impact.split_risk is True
    assert "split" in fast_impact.description.lower()

    balanced_impact = evaluate_group_impact("Balanced", [itin.segments[0]], group)
    assert balanced_impact.split_risk is False
    assert balanced_impact.can_accommodate_all is True
