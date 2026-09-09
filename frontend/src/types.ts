export type RiskState = "SAFE" | "AT_RISK" | "HIGH_RISK" | "DISRUPTED" | "RECOVERED";
export type SegmentType = "FLIGHT" | "TRAIN" | "TRANSFER" | "HOTEL" | "ACTIVITY";

export type GroupPartyMember = {
  id: string;
  name: string;
  role: string;
};

export type GroupInfo = {
  is_group: boolean;
  group_name?: string | null;
  party_size: number;
  members: GroupPartyMember[];
  split_policy: "KEEP_TOGETHER" | "ALLOW_SPLIT" | "SPLIT_IF_SIGNIFICANT_SAVINGS";
};

export type Segment = {
  id: string;
  itinerary_id: string;
  type: SegmentType;
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  location_start?: string | null;
  location_end?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  cost: number;
  status: RiskState;
  vendor_name?: string | null;
  vendor_source?: string | null;
  booking_reference?: string | null;
  historical_delay_rate?: number | null;
  vendor_reliability_score?: number | null;
  predictive_risk_score?: number | null;
};

export type Dependency = {
  id: string;
  source_id: string;
  target_id: string;
  buffer_minutes?: number;
  max_tolerated_delay_minutes?: number;
};

export type Itinerary = {
  id: string;
  user_id: string;
  traveler_name: string;
  name: string;
  segments: Segment[];
  dependencies: Dependency[];
  group_info: GroupInfo;
  resilience_score?: number | null;
  predictive_risk_score?: number | null;
};

export type ItinerarySummary = {
  id: string;
  name: string;
  traveler_name: string;
  segment_count: number;
  status: RiskState;
  locations: string[];
  start_time?: string | null;
  end_time?: string | null;
  resilience_score?: number | null;
  predictive_risk_score?: number | null;
  group_size: number;
};

export type NetCostLedger = {
  new_cost: number;
  refund_owed: number;
  cancellation_penalty: number;
  insurance_claimable: number;
  net_out_of_pocket: number;
  breakdown_notes: string[];
};

export type GroupImpactAnalysis = {
  can_accommodate_all: boolean;
  split_risk: boolean;
  seats_available: number;
  party_size: number;
  description: string;
};

export type RecoveryPlan = {
  id: string;
  name: string;
  description: string;
  cost_change: number;
  time_change_minutes: number;
  score: {
    cost: number;
    time: number;
    itinerary_preservation: number;
    convenience: number;
    traveler_preference: number;
    total: number;
  };
  net_cost_ledger: NetCostLedger;
  group_impact: GroupImpactAnalysis;
  personalization_tag?: string | null;
  added_segments?: Segment[];
  removed_segment_ids?: string[];
};

export type RecoveryResponse = {
  plans: RecoveryPlan[];
  explanation?: {
    recommended_plan_id: string;
    summary: string;
    reason: string;
    actions: string[];
  } | null;
};

export type WeatherRiskFactor = {
  location: string;
  forecast: string;
  temperature_c: number;
  precip_probability: number;
  severity_score: number;
};

export type SegmentPredictiveRisk = {
  segment_id: string;
  segment_name: string;
  route: string;
  historical_delay_rate: number;
  weather_factor: WeatherRiskFactor;
  vendor_name: string;
  vendor_reliability: number;
  risk_score: number;
  risk_band: "LOW" | "MODERATE" | "HIGH";
  advisory: string;
};

export type ItineraryPredictiveRisk = {
  itinerary_id: string;
  overall_risk_score: number;
  overall_risk_band: "LOW" | "MODERATE" | "HIGH";
  summary: string;
  key_drivers: string[];
  segment_risks: SegmentPredictiveRisk[];
};

export type SinglePointOfFailure = {
  segment_id: string;
  segment_name: string;
  buffer_minutes: number;
  cascading_target_count: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  recommendation: string;
};

export type ResilienceAnalysis = {
  itinerary_id: string;
  resilience_score: number;
  resilience_rating: "Vulnerable" | "Moderate" | "Robust";
  spof_count: number;
  spofs: SinglePointOfFailure[];
  tight_buffers_count: number;
  recommendations: string[];
};

export type BookingImportRequest = {
  raw_text?: string;
  source_vendor?: string;
  template_preset?: string;
};

export type ImportedBookingResult = {
  parsed_segment: Segment;
  source_vendor: string;
  booking_reference: string;
  confidence_score: number;
  message: string;
};

export type TravelerPreferenceProfile = {
  user_id: string;
  traveler_name: string;
  total_recoveries_applied: number;
  choices_count: Record<string, number>;
  dominant_preference: string;
  adaptive_weights: Record<string, number>;
  insight: string;
};

export type ClaimExpenseItem = {
  category: string;
  description: string;
  original_cost: number;
  new_cost: number;
  net_loss: number;
  receipt_reference: string;
};

export type ClaimRegulationEntitlement = {
  regulation_code: string;
  entitlement: string;
  estimated_statutory_payout: number;
  description: string;
};

export type ClaimEvidenceBundle = {
  claim_id: string;
  itinerary_id: string;
  itinerary_name: string;
  traveler_name: string;
  carrier_vendor: string;
  disrupted_segment_name: string;
  scheduled_departure: string;
  actual_departure: string;
  delay_duration_minutes: number;
  reason: string;
  verification_hash: string;
  timestamp_generated: string;
  itemized_losses: ClaimExpenseItem[];
  total_claimed_amount: number;
  applicable_regulations: ClaimRegulationEntitlement[];
  status: string;
  carrier_delay_certificate: string;
};

export type SegmentDraft = {
  type: SegmentType;
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  location_start: string;
  location_end: string;
  cost: string;
  vendor_name?: string;
  vendor_source?: string;
  booking_reference?: string;
};
