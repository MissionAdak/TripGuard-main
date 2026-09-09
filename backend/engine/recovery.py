from copy import deepcopy
from datetime import timedelta
from typing import List
from models import (
    ResolutionExplanation,
    Itinerary,
    PlanScore,
    RecoveryPlan,
    RecoveryResponse,
    RiskState,
    Segment,
)
from engine.net_cost import calculate_recovery_net_cost
from engine.group_handling import evaluate_group_impact
from engine.traveler_learning import (
    get_traveler_profile,
    apply_personalized_scoring,
    record_plan_choice,
)


def _shift(segment: Segment, minutes: int) -> Segment:
    updated = segment.model_copy(deep=True)
    updated.start_time = updated.start_time + timedelta(minutes=minutes)
    updated.end_time = updated.end_time + timedelta(minutes=minutes)
    return updated


def generate_recovery_plans(itinerary: Itinerary, delay_minutes: int) -> RecoveryResponse:
    disrupted = next((s for s in itinerary.segments if s.status == RiskState.DISRUPTED), None)
    if not disrupted and itinerary.segments:
        disrupted = itinerary.segments[0]
    if not disrupted:
        return RecoveryResponse(plans=[], explanation=None)

    cheap = _shift(disrupted, delay_minutes + 60)
    cheap.id = f"{disrupted.id}-alt-cheap"
    cheap.name = f"Later option: {disrupted.name}"
    cheap.cost = round(max(0.0, disrupted.cost * 0.65), 2)
    cheap.status = RiskState.RECOVERED
    cheap.description = "Lower-cost later departure with budget alternative"

    fast = _shift(disrupted, max(30, delay_minutes // 3))
    fast.id = f"{disrupted.id}-alt-fast"
    fast.name = f"Priority rebook: {disrupted.name}"
    fast.cost = round(disrupted.cost * 1.8, 2)
    fast.status = RiskState.RECOVERED
    fast.description = "Faster expedited rebooking on premium inventory"

    balanced = _shift(disrupted, delay_minutes)
    balanced.id = f"{disrupted.id}-alt-balanced"
    balanced.name = f"Next available: {disrupted.name}"
    balanced.cost = disrupted.cost
    balanced.status = RiskState.RECOVERED
    balanced.description = "Same carrier re-accommodation with schedule shift"

    # Feature 2: True Net Cost Ledgers
    cheap_ledger = calculate_recovery_net_cost("Cheapest", disrupted, [cheap], delay_minutes)
    fast_ledger = calculate_recovery_net_cost("Fastest", disrupted, [fast], delay_minutes)
    balanced_ledger = calculate_recovery_net_cost("Balanced", disrupted, [balanced], delay_minutes)

    # Feature 7: Group Split Evaluation
    cheap_group = evaluate_group_impact("Cheapest", [cheap], itinerary.group_info)
    fast_group = evaluate_group_impact("Fastest", [fast], itinerary.group_info)
    balanced_group = evaluate_group_impact("Balanced", [balanced], itinerary.group_info)

    # Feature 5: Adaptive Traveler Learning Profile
    profile = get_traveler_profile(itinerary.user_id, itinerary.traveler_name)

    # Base scores
    base_cheap_score = PlanScore(cost=90, time=40, itinerary_preservation=50, convenience=40, traveler_preference=55, total=58)
    base_fast_score = PlanScore(cost=25, time=92, itinerary_preservation=80, convenience=78, traveler_preference=70, total=68)
    base_balanced_score = PlanScore(cost=80, time=70, itinerary_preservation=88, convenience=75, traveler_preference=82, total=81)

    cheap_score, cheap_tag = apply_personalized_scoring("plan-cheapest", "Cheapest", base_cheap_score, profile)
    fast_score, fast_tag = apply_personalized_scoring("plan-fastest", "Fastest", base_fast_score, profile)
    balanced_score, balanced_tag = apply_personalized_scoring("plan-balanced", "Balanced", base_balanced_score, profile)

    plans = [
        RecoveryPlan(
            id="plan-cheapest",
            name="Cheapest",
            description=f"Take a later budget alternative for {disrupted.name}.",
            added_segments=[cheap],
            removed_segment_ids=[disrupted.id],
            score=cheap_score,
            cost_change=cheap_ledger.net_out_of_pocket,
            time_change_minutes=delay_minutes + 60,
            affected_activities_ids=[],
            net_cost_ledger=cheap_ledger,
            group_impact=cheap_group,
            personalization_tag=cheap_tag,
        ),
        RecoveryPlan(
            id="plan-fastest",
            name="Fastest",
            description=f"Expedited premium recovery for {disrupted.name}.",
            added_segments=[fast],
            removed_segment_ids=[disrupted.id],
            score=fast_score,
            cost_change=fast_ledger.net_out_of_pocket,
            time_change_minutes=max(30, delay_minutes // 3),
            affected_activities_ids=[],
            net_cost_ledger=fast_ledger,
            group_impact=fast_group,
            personalization_tag=fast_tag,
        ),
        RecoveryPlan(
            id="plan-balanced",
            name="Balanced (Recommended)",
            description=f"Maintain {disrupted.name} carrier and push clock by {delay_minutes}m.",
            added_segments=[balanced],
            removed_segment_ids=[disrupted.id],
            score=balanced_score,
            cost_change=balanced_ledger.net_out_of_pocket,
            time_change_minutes=delay_minutes,
            affected_activities_ids=[],
            net_cost_ledger=balanced_ledger,
            group_impact=balanced_group,
            personalization_tag=balanced_tag,
        ),
    ]

    # Select best recommendation based on total adaptive score
    best_plan = max(plans, key=lambda p: p.score.total)

    explanation = ResolutionExplanation(
        recommended_plan_id=best_plan.id,
        summary=f"The {best_plan.name} plan is recommended. Net out-of-pocket: ₹{best_plan.net_cost_ledger.net_out_of_pocket:.2f}.",
        reason=(
            f"{disrupted.name} was disrupted by {delay_minutes} minutes. "
            f"{best_plan.description} "
            f"Carrier refund of ${best_plan.net_cost_ledger.refund_owed:.2f} and insurance claimable of ${best_plan.net_cost_ledger.insurance_claimable:.2f} "
            f"reduce your net loss. {best_plan.group_impact.description}"
        ),
        actions=[
            f"Replace {disrupted.name}",
            f"Apply net ledger adjustment (New: ${best_plan.net_cost_ledger.new_cost:.2f}, Refund: -${best_plan.net_cost_ledger.refund_owed:.2f})",
            f"Verify group integrity: {best_plan.group_impact.party_size} traveler(s)",
            f"Shift downstream legs by {best_plan.time_change_minutes} minutes",
        ],
    )
    return RecoveryResponse(plans=plans, explanation=explanation)


def apply_plan(itinerary: Itinerary, plan: RecoveryPlan) -> Itinerary:
    # Record choice into traveler learning
    record_plan_choice(itinerary.user_id, plan.id, plan.name)

    updated = deepcopy(itinerary)
    replacements = {rid: plan.added_segments[0] for rid in plan.removed_segment_ids if plan.added_segments}

    updated.segments = [s for s in updated.segments if s.id not in plan.removed_segment_ids]
    for added in plan.added_segments:
        added.itinerary_id = itinerary.id
        updated.segments.append(added)

    for dep in updated.dependencies:
        if dep.source_id in replacements:
            dep.source_id = replacements[dep.source_id].id
        if dep.target_id in replacements:
            dep.target_id = replacements[dep.target_id].id

    shift = plan.time_change_minutes
    replaced_ids = {s.id for s in plan.added_segments}
    for segment in updated.segments:
        if segment.id not in replaced_ids and segment.status in {RiskState.AT_RISK, RiskState.DISRUPTED, RiskState.HIGH_RISK}:
            segment.start_time += timedelta(minutes=shift)
            segment.end_time += timedelta(minutes=shift)
            segment.status = RiskState.RECOVERED

    return updated
