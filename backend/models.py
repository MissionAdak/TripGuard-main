from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class RiskState(str, Enum):
    SAFE = "SAFE"
    AT_RISK = "AT_RISK"
    HIGH_RISK = "HIGH_RISK"
    DISRUPTED = "DISRUPTED"
    RECOVERED = "RECOVERED"

class SegmentType(str, Enum):
    FLIGHT = "FLIGHT"
    TRAIN = "TRAIN"
    TRANSFER = "TRANSFER"
    HOTEL = "HOTEL"
    ACTIVITY = "ACTIVITY"

class GroupSplitPolicy(str, Enum):
    KEEP_TOGETHER = "KEEP_TOGETHER"
    ALLOW_SPLIT = "ALLOW_SPLIT"
    SPLIT_IF_SIGNIFICANT_SAVINGS = "SPLIT_IF_SIGNIFICANT_SAVINGS"

class GroupPartyMember(BaseModel):
    id: str
    name: str
    role: str = "traveler" # "primary", "traveler", "child"

class GroupInfo(BaseModel):
    is_group: bool = False
    group_name: Optional[str] = "Family & Friends"
    party_size: int = 1
    members: List[GroupPartyMember] = []
    split_policy: GroupSplitPolicy = GroupSplitPolicy.KEEP_TOGETHER

class Segment(BaseModel):
    id: str
    itinerary_id: str
    type: SegmentType
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location_start: Optional[str] = None
    location_end: Optional[str] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    cost: float = 0.0
    status: RiskState = RiskState.SAFE
    is_locked: bool = False
    # Feature 1 & 3 fields:
    vendor_name: Optional[str] = None # e.g. "Air India", "Booking.com", "Viator"
    vendor_source: Optional[str] = None # e.g. "Direct", "Booking.com", "Airbnb", "Expedia"
    booking_reference: Optional[str] = None # e.g. "AI-89240", "BK-82917"
    historical_delay_rate: Optional[float] = None # e.g. 24.5 (%)
    vendor_reliability_score: Optional[float] = None # e.g. 82.0 (%)
    predictive_risk_score: Optional[int] = None # 0-100 pre-departure risk

class DependencyType(str, Enum):
    SEQUENTIAL = "SEQUENTIAL"      # A must finish before B starts
    LOCATION_SYNC = "LOCATION_SYNC" # B requires A to end at the same location B starts

class Dependency(BaseModel):
    id: str
    source_id: str
    target_id: str
    type: DependencyType = DependencyType.SEQUENTIAL
    buffer_minutes: int = 60 # Required buffer between segments
    max_tolerated_delay_minutes: int = 120 # Maximum delay on source before target is disrupted

class Itinerary(BaseModel):
    id: str
    user_id: str = "guest"
    traveler_name: str = "Guest traveler"
    name: str
    segments: List[Segment]
    dependencies: List[Dependency]
    # Advanced features
    group_info: GroupInfo = Field(default_factory=GroupInfo)
    resilience_score: Optional[int] = None
    predictive_risk_score: Optional[int] = None

class SegmentInput(BaseModel):
    type: SegmentType
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location_start: Optional[str] = None
    location_end: Optional[str] = None
    cost: float = 0.0
    vendor_name: Optional[str] = None
    vendor_source: Optional[str] = "Manual"
    booking_reference: Optional[str] = None

class ItineraryCreate(BaseModel):
    name: str
    traveler_name: str = "Guest traveler"
    user_id: str = "guest"
    segments: List[SegmentInput]
    group_info: Optional[GroupInfo] = None

class ItinerarySummary(BaseModel):
    id: str
    name: str
    traveler_name: str
    segment_count: int
    status: RiskState
    locations: List[str]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    resilience_score: Optional[int] = None
    predictive_risk_score: Optional[int] = None
    group_size: int = 1

class GeocodeResult(BaseModel):
    query: str
    lat: Optional[float] = None
    lng: Optional[float] = None

class DisruptionEvent(BaseModel):
    segment_id: str
    delay_minutes: int
    reason: str = "Weather delay"

class PlanScore(BaseModel):
    cost: float
    time: float
    itinerary_preservation: float
    convenience: float
    traveler_preference: float
    total: float

# Feature 2: Net Cost Ledger
class NetCostLedger(BaseModel):
    new_cost: float
    refund_owed: float
    cancellation_penalty: float
    insurance_claimable: float
    net_out_of_pocket: float # new_cost - refund_owed + cancellation_penalty - insurance_claimable
    breakdown_notes: List[str] = []

# Feature 7: Group Impact Analysis
class GroupImpactAnalysis(BaseModel):
    can_accommodate_all: bool = True
    split_risk: bool = False
    seats_available: int = 4
    party_size: int = 1
    description: str = "Entire party kept together seamlessly"

class RecoveryPlan(BaseModel):
    id: str
    name: str # e.g., "Cheapest", "Fastest", "Balanced"
    description: str
    added_segments: List[Segment]
    removed_segment_ids: List[str]
    score: PlanScore
    cost_change: float # legacy compatibility
    time_change_minutes: int
    affected_activities_ids: List[str]
    # Feature 2 & 5 & 7 additions:
    net_cost_ledger: NetCostLedger
    group_impact: GroupImpactAnalysis
    personalization_tag: Optional[str] = None # e.g. "Matches your frequent choice (Balanced)"

class ResolutionExplanation(BaseModel):
    recommended_plan_id: str
    summary: str
    reason: str
    actions: List[str]

class RecoveryResponse(BaseModel):
    plans: List[RecoveryPlan]
    explanation: Optional[ResolutionExplanation] = None

# Feature 1: Predictive Risk
class WeatherRiskFactor(BaseModel):
    location: str
    forecast: str # e.g. "Thunderstorm warning", "Clear", "Monsoon fog"
    temperature_c: float
    precip_probability: int
    severity_score: int # 0-100

class SegmentPredictiveRisk(BaseModel):
    segment_id: str
    segment_name: str
    route: str
    historical_delay_rate: float # % e.g. 24.0%
    weather_factor: WeatherRiskFactor
    vendor_name: str
    vendor_reliability: float # % e.g. 84.0%
    risk_score: int # 0-100 calculated
    risk_band: str # "LOW" | "MODERATE" | "HIGH"
    advisory: str

class ItineraryPredictiveRisk(BaseModel):
    itinerary_id: str
    overall_risk_score: int # 0-100
    overall_risk_band: str # "LOW" | "MODERATE" | "HIGH"
    summary: str
    key_drivers: List[str]
    segment_risks: List[SegmentPredictiveRisk]

# Feature 4: Structural Resilience & SPOF
class SinglePointOfFailure(BaseModel):
    segment_id: str
    segment_name: str
    buffer_minutes: int
    cascading_target_count: int
    severity: str # "HIGH" | "MEDIUM" | "LOW"
    description: str
    recommendation: str

class ResilienceAnalysis(BaseModel):
    itinerary_id: str
    resilience_score: int # 0-100
    resilience_rating: str # "Vulnerable" | "Moderate" | "Robust"
    spof_count: int
    spofs: List[SinglePointOfFailure]
    tight_buffers_count: int
    recommendations: List[str]

# Feature 3: External Booking Import
class BookingImportRequest(BaseModel):
    raw_text: Optional[str] = None
    source_vendor: Optional[str] = None # "Booking.com", "Airbnb", "Expedia", "Viator", etc.
    template_preset: Optional[str] = None # "booking_hotel", "airbnb_villa", "viator_tour"

class ImportedBookingResult(BaseModel):
    parsed_segment: Segment
    source_vendor: str
    booking_reference: str
    confidence_score: float
    message: str

# Feature 5: Traveler Preference Profile
class TravelerPreferenceProfile(BaseModel):
    user_id: str
    traveler_name: str
    total_recoveries_applied: int = 0
    choices_count: Dict[str, int] = {"cheapest": 0, "fastest": 0, "balanced": 0}
    dominant_preference: str = "Balanced"
    adaptive_weights: Dict[str, float] = {
        "cost": 0.25,
        "time": 0.25,
        "preservation": 0.25,
        "convenience": 0.25
    }
    insight: str = "Default balanced weighting."

# Feature 6: Insurance Claim Evidence Bundle
class ClaimExpenseItem(BaseModel):
    category: str
    description: str
    original_cost: float
    new_cost: float
    net_loss: float
    receipt_reference: str

class ClaimRegulationEntitlement(BaseModel):
    regulation_code: str # e.g. "DGCA CAR Sec 3", "EU261/2004", "US DOT 14 CFR"
    entitlement: str
    estimated_statutory_payout: float
    description: str

class ClaimEvidenceBundle(BaseModel):
    claim_id: str
    itinerary_id: str
    itinerary_name: str
    traveler_name: str
    carrier_vendor: str
    disrupted_segment_name: str
    scheduled_departure: datetime
    actual_departure: datetime
    delay_duration_minutes: int
    reason: str
    verification_hash: str
    timestamp_generated: datetime
    itemized_losses: List[ClaimExpenseItem]
    total_claimed_amount: float
    applicable_regulations: List[ClaimRegulationEntitlement]
    status: str = "VERIFIED_EVIDENCE_READY"
    carrier_delay_certificate: str
