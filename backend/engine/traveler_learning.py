"""
Traveler Preference Learning Engine.

Learns traveler preferences over time based on actual recovery plan choices:
  - Tracks historical choices (Cheapest, Fastest, Balanced)
  - Dynamically adapts scoring weights
  - Pre-selects and tags recommendations matching traveler habits
"""

from typing import Dict
from models import PlanScore, TravelerPreferenceProfile

# In-memory preference learning store
_traveler_store: Dict[str, TravelerPreferenceProfile] = {}


def get_traveler_profile(user_id: str = "guest", traveler_name: str = "Guest traveler") -> TravelerPreferenceProfile:
    if user_id not in _traveler_store:
        _traveler_store[user_id] = TravelerPreferenceProfile(
            user_id=user_id,
            traveler_name=traveler_name,
            total_recoveries_applied=2,
            choices_count={"cheapest": 0, "fastest": 0, "balanced": 2},
            dominant_preference="Balanced",
            adaptive_weights={"cost": 0.20, "time": 0.25, "preservation": 0.35, "convenience": 0.20},
            insight="You consistently favor Balanced plans that protect your original itinerary.",
        )
    return _traveler_store[user_id]


def record_plan_choice(user_id: str, plan_id: str, plan_name: str):
    profile = get_traveler_profile(user_id)
    key = "balanced"
    if "cheap" in plan_id.lower() or "cheap" in plan_name.lower():
        key = "cheapest"
    elif "fast" in plan_id.lower() or "fast" in plan_name.lower():
        key = "fastest"

    profile.choices_count[key] = profile.choices_count.get(key, 0) + 1
    profile.total_recoveries_applied += 1

    total = sum(profile.choices_count.values()) or 1
    dominant = max(profile.choices_count.items(), key=lambda x: x[1])[0]
    profile.dominant_preference = dominant.title()

    # Re-calculate adaptive weights based on behavioral history
    cheap_pct = profile.choices_count.get("cheapest", 0) / total
    fast_pct = profile.choices_count.get("fastest", 0) / total
    bal_pct = profile.choices_count.get("balanced", 0) / total

    profile.adaptive_weights = {
        "cost": round(0.15 + 0.30 * cheap_pct, 2),
        "time": round(0.15 + 0.30 * fast_pct, 2),
        "preservation": round(0.20 + 0.30 * bal_pct, 2),
        "convenience": round(0.20 + 0.15 * bal_pct, 2),
    }

    dominant_pct = int(round(100 * profile.choices_count.get(dominant, 0) / total))
    profile.insight = (
        f"Learned Travel Style: You selected {dominant.title()} in {dominant_pct}% of past disruptions. "
        f"Algorithms now auto-weight recovery options for your preference."
    )


def apply_personalized_scoring(plan_id: str, plan_name: str, base_score: PlanScore, profile: TravelerPreferenceProfile) -> tuple[PlanScore, str | None]:
    dominant = profile.dominant_preference.lower()
    is_match = False
    personalization_tag = None

    if dominant == "cheapest" and ("cheap" in plan_id.lower() or "cheap" in plan_name.lower()):
        is_match = True
    elif dominant == "fastest" and ("fast" in plan_id.lower() or "fast" in plan_name.lower()):
        is_match = True
    elif dominant == "balanced" and ("balanced" in plan_id.lower() or "balanced" in plan_name.lower()):
        is_match = True

    pref_score = base_score.traveler_preference
    if is_match:
        pref_score = min(98.0, pref_score + 15.0)
        personalization_tag = f"Personalized: Matches your frequent choice ({profile.dominant_preference})"

    # Recompute weighted total
    w = profile.adaptive_weights
    total = (
        base_score.cost * w.get("cost", 0.25)
        + base_score.time * w.get("time", 0.25)
        + base_score.itinerary_preservation * w.get("preservation", 0.25)
        + base_score.convenience * w.get("convenience", 0.25)
        + pref_score * 0.10
    )

    new_score = PlanScore(
        cost=base_score.cost,
        time=base_score.time,
        itinerary_preservation=base_score.itinerary_preservation,
        convenience=base_score.convenience,
        traveler_preference=round(pref_score, 1),
        total=round(min(99.0, max(20.0, total)), 1),
    )

    return new_score, personalization_tag


def reset_traveler_preferences(user_id: str = "guest") -> TravelerPreferenceProfile:
    _traveler_store[user_id] = TravelerPreferenceProfile(
        user_id=user_id,
        traveler_name="Guest traveler",
        total_recoveries_applied=0,
        choices_count={"cheapest": 0, "fastest": 0, "balanced": 0},
        dominant_preference="Balanced",
        adaptive_weights={"cost": 0.25, "time": 0.25, "preservation": 0.25, "convenience": 0.25},
        insight="Preferences reset. System will adapt anew to your choices.",
    )
    return _traveler_store[user_id]
