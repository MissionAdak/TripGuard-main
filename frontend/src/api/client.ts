import type {
  BookingImportRequest,
  ClaimEvidenceBundle,
  GroupInfo,
  ImportedBookingResult,
  Itinerary,
  ItineraryPredictiveRisk,
  ItinerarySummary,
  RecoveryResponse,
  ResilienceAnalysis,
  SegmentDraft,
  TravelerPreferenceProfile,
} from "../types";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return res.json();
}

export function listItineraries() {
  return fetch(`${API_BASE}/itineraries`).then((res) => parse<ItinerarySummary[]>(res));
}

export function fetchItinerary(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}`).then((res) => parse<Itinerary>(res));
}

export function createItinerary(payload: {
  name: string;
  traveler_name: string;
  segments: Array<Omit<SegmentDraft, "cost"> & { cost: number }>;
  group_info?: GroupInfo;
}) {
  return fetch(`${API_BASE}/itineraries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => parse<Itinerary>(res));
}

export function updateItinerary(
  id: string,
  payload: {
    name: string;
    traveler_name: string;
    segments: Array<Omit<SegmentDraft, "cost"> & { cost: number }>;
    group_info?: GroupInfo;
  },
) {
  return fetch(`${API_BASE}/itinerary/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => parse<Itinerary>(res));
}

export function deleteItinerary(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}`, { method: "DELETE" }).then((res) => parse<{ ok: boolean }>(res));
}

export function disruptItinerary(id: string, segmentId: string, delayMinutes: number) {
  return fetch(`${API_BASE}/itinerary/${id}/disrupt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segment_id: segmentId, delay_minutes: delayMinutes, reason: "Manual disruption" }),
  }).then((res) => parse<Itinerary>(res));
}

export function getRecoveryPlans(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}/recover`).then((res) => parse<RecoveryResponse>(res));
}

export function applyRecoveryPlan(itinId: string, planId: string) {
  return fetch(`${API_BASE}/itinerary/${itinId}/apply-plan/${planId}`, { method: "POST" }).then((res) =>
    parse<Itinerary>(res),
  );
}

export function resetItinerary(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}/reset`, { method: "POST" }).then((res) => parse<Itinerary>(res));
}

// Feature 1: Predictive Risk
export function fetchPredictiveRisk(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}/predictive-risk`).then((res) => parse<ItineraryPredictiveRisk>(res));
}

// Feature 4: Structural Resilience & SPOF
export function fetchResilience(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}/resilience`).then((res) => parse<ResilienceAnalysis>(res));
}

// Feature 3: External Booking Import
export function importBooking(itinId: string, request: BookingImportRequest) {
  return fetch(`${API_BASE}/itinerary/${itinId}/import-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  }).then((res) => parse<ImportedBookingResult>(res));
}

// Feature 6: Insurance Claim Evidence
export function fetchClaimEvidence(itinId: string) {
  return fetch(`${API_BASE}/itinerary/${itinId}/claim-evidence`).then((res) => parse<ClaimEvidenceBundle>(res));
}

// Feature 5: Traveler Preferences
export function fetchTravelerPreferences() {
  return fetch(`${API_BASE}/traveler/preferences`).then((res) => parse<TravelerPreferenceProfile>(res));
}

export function resetTravelerPreferences() {
  return fetch(`${API_BASE}/traveler/preferences/reset`, { method: "POST" }).then((res) =>
    parse<TravelerPreferenceProfile>(res),
  );
}

// Feature 7: Update Group
export function updateGroup(itinId: string, group: GroupInfo) {
  return fetch(`${API_BASE}/itinerary/${itinId}/group`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(group),
  }).then((res) => parse<Itinerary>(res));
}

// Data simulation & reset
export function simulateData() {
  return fetch(`${API_BASE}/simulate-data`, { method: "POST" }).then((res) => parse<Itinerary>(res));
}

export function clearData() {
  return fetch(`${API_BASE}/clear-data`, { method: "POST" }).then((res) => parse<{ ok: boolean }>(res));
}
