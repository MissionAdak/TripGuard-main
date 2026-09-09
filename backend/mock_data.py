from datetime import datetime, timedelta
from typing import List
from models import (
    Dependency,
    DependencyType,
    GroupInfo,
    GroupPartyMember,
    GroupSplitPolicy,
    Itinerary,
    PlanScore,
    RecoveryPlan,
    RiskState,
    Segment,
    SegmentType,
)
from engine.net_cost import calculate_recovery_net_cost
from engine.group_handling import evaluate_group_impact

def get_base_time():
    # Deterministic demo date
    return datetime(2026, 10, 15, 8, 0)

def get_mock_itinerary() -> Itinerary:
    base = get_base_time()

    seg1 = Segment(
        id="seg-1",
        itinerary_id="ITIN-100",
        type=SegmentType.FLIGHT,
        name="Flight Mumbai → Delhi",
        description="Air India AI-101",
        start_time=base,
        end_time=base + timedelta(hours=2),
        location_start="Mumbai (BOM)",
        location_end="Delhi (DEL)",
        start_lat=19.0896,
        start_lng=72.8656,
        end_lat=28.5562,
        end_lng=77.1000,
        cost=150.0,
        vendor_name="Air India",
        vendor_source="Direct Airline",
        booking_reference="AI-882194",
        historical_delay_rate=28.5,
        vendor_reliability_score=74.0,
    )

    seg2 = Segment(
        id="seg-2",
        itinerary_id="ITIN-100",
        type=SegmentType.TRANSFER,
        name="Airport Transfer Cab",
        description="Private Chauffeur to Hotel",
        start_time=base + timedelta(hours=2, minutes=30),
        end_time=base + timedelta(hours=3, minutes=30),
        location_start="Delhi (DEL)",
        location_end="Taj Palace, Delhi",
        start_lat=28.5562,
        start_lng=77.1000,
        end_lat=28.5950,
        end_lng=77.1712,
        cost=30.0,
        vendor_name="Private Cab Transfer",
        vendor_source="Expedia",
        booking_reference="EXP-CAB-4402",
        historical_delay_rate=12.0,
        vendor_reliability_score=91.0,
    )

    seg3 = Segment(
        id="seg-3",
        itinerary_id="ITIN-100",
        type=SegmentType.HOTEL,
        name="Hotel Check-in Taj Palace",
        description="Luxury Heritage Suite (Imported from Booking.com)",
        start_time=base + timedelta(hours=3, minutes=30),
        end_time=base + timedelta(days=1, hours=10),
        location_start="Taj Palace, Delhi",
        location_end="Taj Palace, Delhi",
        start_lat=28.5950,
        start_lng=77.1712,
        end_lat=28.5950,
        end_lng=77.1712,
        cost=200.0,
        vendor_name="Taj Palace",
        vendor_source="Booking.com",
        booking_reference="BK-9928174",
        historical_delay_rate=5.0,
        vendor_reliability_score=96.0,
    )

    seg4 = Segment(
        id="seg-4",
        itinerary_id="ITIN-100",
        type=SegmentType.ACTIVITY,
        name="Dinner Reservation Bukhara",
        description="Famous Tandoori Heritage Dining (Imported from Viator)",
        start_time=base + timedelta(hours=11), # 7 PM
        end_time=base + timedelta(hours=13),
        location_start="ITC Maurya, Delhi",
        location_end="ITC Maurya, Delhi",
        start_lat=28.5975,
        start_lng=77.1736,
        end_lat=28.5975,
        end_lng=77.1736,
        cost=100.0,
        vendor_name="Viator Excursions",
        vendor_source="Viator",
        booking_reference="VIA-91023",
        historical_delay_rate=6.0,
        vendor_reliability_score=93.0,
    )

    seg5 = Segment(
        id="seg-5",
        itinerary_id="ITIN-100",
        type=SegmentType.TRAIN,
        name="Train Delhi → Jaipur",
        description="Shatabdi Express AC Chair Car",
        start_time=base + timedelta(days=1, hours=11),
        end_time=base + timedelta(days=1, hours=16),
        location_start="New Delhi Railway Station",
        location_end="Jaipur Junction",
        start_lat=28.6430,
        start_lng=77.2195,
        end_lat=26.9200,
        end_lng=75.7878,
        cost=25.0,
        vendor_name="Indian Railways",
        vendor_source="IRCTC Rail",
        booking_reference="PNR-829104",
        historical_delay_rate=14.0,
        vendor_reliability_score=82.0,
    )

    dep1 = Dependency(id="dep-1", source_id="seg-1", target_id="seg-2", buffer_minutes=30, max_tolerated_delay_minutes=60)
    dep2 = Dependency(id="dep-2", source_id="seg-2", target_id="seg-3", buffer_minutes=0, max_tolerated_delay_minutes=120)
    dep3 = Dependency(id="dep-3", source_id="seg-3", target_id="seg-4", buffer_minutes=120, max_tolerated_delay_minutes=240)
    dep4 = Dependency(id="dep-4", source_id="seg-3", target_id="seg-5", buffer_minutes=0, max_tolerated_delay_minutes=1440)

    # Feature 7: Group Info (Party of 3)
    group = GroupInfo(
        is_group=True,
        group_name="Shah Family Tour",
        party_size=3,
        members=[
            GroupPartyMember(id="mem-1", name="Priya Shah", role="primary"),
            GroupPartyMember(id="mem-2", name="Rohan Shah", role="traveler"),
            GroupPartyMember(id="mem-3", name="Ananya Shah", role="traveler"),
        ],
        split_policy=GroupSplitPolicy.KEEP_TOGETHER,
    )

    return Itinerary(
        id="ITIN-100",
        user_id="guest",
        traveler_name="Priya Shah & Group",
        name="Golden Triangle Tour (Mumbai-Delhi-Jaipur)",
        segments=[seg1, seg2, seg3, seg4, seg5],
        dependencies=[dep1, dep2, dep3, dep4],
        group_info=group,
    )
