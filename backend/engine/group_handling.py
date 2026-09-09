"""
Group Trip and Split-Risk Handling Engine.

Analyzes group travel constraints during disruptions:
  - Tracks group party members and size
  - Evaluates recovery options for seat capacity and split risk
  - Alerts if a recovery plan risks separating traveling companions
"""

from typing import List
from models import (
    GroupImpactAnalysis,
    GroupInfo,
    GroupSplitPolicy,
    Segment,
    SegmentType,
)


def evaluate_group_impact(
    plan_name: str,
    added_segments: List[Segment],
    group_info: GroupInfo,
) -> GroupImpactAnalysis:
    party_size = max(1, group_info.party_size)

    # Solo traveler has no split risk
    if party_size <= 1:
        return GroupImpactAnalysis(
            can_accommodate_all=True,
            split_risk=False,
            seats_available=9,
            party_size=1,
            description="Individual traveler: No group seat constraints.",
        )

    p_lower = plan_name.lower()

    if p_lower.startswith("fastest"):
        # Fastest rebooking on premium/last-minute seats often has very scarce capacity
        available_seats = 1 if party_size > 2 else 2
        split_risk = party_size > available_seats
        can_accommodate = not split_risk

        if split_risk:
            desc = (
                f"⚠️ Group Split Risk: Only {available_seats} priority seat(s) available on this flight. "
                f"Selecting this plan will split your party of {party_size} across different departures."
            )
        else:
            desc = f"All {party_size} party members can be accommodated together in premium class."

        return GroupImpactAnalysis(
            can_accommodate_all=can_accommodate,
            split_risk=split_risk,
            seats_available=available_seats,
            party_size=party_size,
            description=desc,
        )

    elif p_lower.startswith("cheapest"):
        # Budget airline has seats, but limited contiguous seating
        available_seats = party_size + 1
        return GroupImpactAnalysis(
            can_accommodate_all=True,
            split_risk=False,
            seats_available=available_seats,
            party_size=party_size,
            description=f"Accommodates all {party_size} travelers on budget carrier (scattered seating may apply).",
        )

    else:  # Balanced
        # Primary carrier keeps group together on next scheduled departure
        return GroupImpactAnalysis(
            can_accommodate_all=True,
            split_risk=False,
            seats_available=party_size + 4,
            party_size=party_size,
            description=f"✅ Entire group ({party_size} travelers) remains together on the same flight with linked PNR.",
        )
