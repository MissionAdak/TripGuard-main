"""
True Net Cost Ledger Engine for Recovery Options.

Calculates the true out-of-pocket financial impact:
  net_cost = new_cost - refund_owed + cancellation_penalty - insurance_claimable
"""

from typing import List
from models import NetCostLedger, Segment, SegmentType


def calculate_recovery_net_cost(
    plan_name: str,
    original_disrupted_segment: Segment,
    added_segments: List[Segment],
    delay_minutes: int,
) -> NetCostLedger:
    new_cost = sum(s.cost for s in added_segments)
    orig_cost = original_disrupted_segment.cost

    # 1. Refund Owed:
    # If the flight or train is heavily delayed (> 120 mins) or replaced, carrier regulations
    # (DGCA CAR, EU261, DOT) mandate full refund or rebooking credit of the original leg.
    refund_owed = 0.0
    if plan_name.lower().startswith("cheapest"):
        # Passenger downgraded or rebooked with budget carrier, original airline issues credit/refund
        refund_owed = round(orig_cost * 0.90, 2)
    elif plan_name.lower().startswith("fastest"):
        # Passenger pays for expedited class, partial refund on original economy fare
        refund_owed = round(orig_cost * 0.50, 2)
    else:  # Balanced
        # Direct carrier re-accommodation: 100% cost of original leg credited toward the new leg
        refund_owed = round(orig_cost, 2)

    # 2. Cancellation Penalty:
    # E.g. Same-day non-refundable fee if switching vendors, or $0 if airline involuntary delay
    cancellation_penalty = 0.0
    if plan_name.lower().startswith("cheapest"):
        # Small administrative cancellation fee on budget ticket
        cancellation_penalty = 15.0
    elif plan_name.lower().startswith("fastest"):
        cancellation_penalty = 0.0  # Instant rebooking waiver
    else:
        cancellation_penalty = 0.0  # Involuntary delay waiver

    # 3. Insurance Claimable:
    # For delays >= 180 min (3 hours), travel insurance policies cover delay allowance
    # (meals $50, hotel if overnight $150, or statutory compensation)
    insurance_claimable = 0.0
    if delay_minutes >= 180:
        if original_disrupted_segment.type == SegmentType.FLIGHT:
            insurance_claimable = 100.0  # Trip delay allowance (food + refreshments)
        elif original_disrupted_segment.type == SegmentType.TRAIN:
            insurance_claimable = 35.0
    elif delay_minutes >= 60:
        insurance_claimable = 25.0

    # True Net Out of Pocket
    net_out_of_pocket = round(
        new_cost - refund_owed + cancellation_penalty - insurance_claimable, 2
    )

    notes = [
        f"New booking fare: ₹{new_cost:.2f}",
        f"Refund/carrier credit owed: -₹{refund_owed:.2f} (involuntary schedule change)",
    ]
    if cancellation_penalty > 0:
        notes.append(f"Carrier processing fee: +₹{cancellation_penalty:.2f}")
    if insurance_claimable > 0:
        notes.append(
            f"Insurance & passenger charter claimable: -₹{insurance_claimable:.2f} (delay >= {delay_minutes}m)"
        )

    if net_out_of_pocket <= 0:
        notes.append(f"🎉 Net traveler savings / credit balance: ₹{abs(net_out_of_pocket):.2f}")
    else:
        notes.append(f"True out-of-pocket expense: ₹{net_out_of_pocket:.2f}")

    return NetCostLedger(
        new_cost=round(new_cost, 2),
        refund_owed=round(refund_owed, 2),
        cancellation_penalty=round(cancellation_penalty, 2),
        insurance_claimable=round(insurance_claimable, 2),
        net_out_of_pocket=net_out_of_pocket,
        breakdown_notes=notes,
    )
