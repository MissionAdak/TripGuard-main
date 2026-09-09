"""
Predictive Risk Scoring Engine for TripGuard.

Calculates pre-departure risk score based on:
  risk_score = f(historical_delay_rate(route), weather_forecast(location), vendor_reliability(vendor))
"""

from typing import Dict, Tuple
from models import (
    Itinerary,
    Segment,
    SegmentType,
    WeatherRiskFactor,
    SegmentPredictiveRisk,
    ItineraryPredictiveRisk,
)

# Route-specific historical delay rate database (percentage of delays > 30 mins)
ROUTE_DELAY_DB: Dict[Tuple[str, str], float] = {
    ("mumbai", "delhi"): 28.5,
    ("delhi", "mumbai"): 26.0,
    ("delhi", "jaipur"): 14.0,
    ("mumbai", "goa"): 18.2,
    ("bangalore", "delhi"): 22.0,
    ("delhi", "agra"): 12.5,
    ("london", "paris"): 16.0,
    ("new york", "chicago"): 31.0,
}

# Vendor reliability database (on-time rate percentage)
VENDOR_RELIABILITY_DB: Dict[str, float] = {
    "air india": 74.0,
    "indigo": 87.5,
    "vistara": 89.0,
    "spicejet": 68.0,
    "shatabdi express": 82.0,
    "rajdhani express": 85.0,
    "indian railways": 78.0,
    "uber": 88.0,
    "private cab": 91.0,
    "booking.com": 92.0,
    "airbnb": 90.0,
    "viator": 93.0,
    "taj palace": 96.0,
    "marriott": 95.0,
}

# Destination weather lookup (mocked real-time forecast engine with meteorological conditions)
WEATHER_FORECAST_DB: Dict[str, WeatherRiskFactor] = {
    "delhi": WeatherRiskFactor(
        location="Delhi (DEL)",
        forecast="Monsoon fog & smog advisory with reduced runway visibility",
        temperature_c=29.5,
        precip_probability=65,
        severity_score=68,
    ),
    "mumbai": WeatherRiskFactor(
        location="Mumbai (BOM)",
        forecast="Intermittent heavy coastal showers; wet runway operations",
        temperature_c=31.0,
        precip_probability=75,
        severity_score=62,
    ),
    "jaipur": WeatherRiskFactor(
        location="Jaipur (JAI)",
        forecast="Clear skies and calm winds; optimal transit conditions",
        temperature_c=34.0,
        precip_probability=10,
        severity_score=15,
    ),
    "goa": WeatherRiskFactor(
        location="Goa (GOI)",
        forecast="Tropical thunderstorm warnings in the evening",
        temperature_c=28.0,
        precip_probability=80,
        severity_score=72,
    ),
    "london": WeatherRiskFactor(
        location="London (LHR)",
        forecast="Overcast with light drizzle and low crosswinds",
        temperature_c=17.0,
        precip_probability=45,
        severity_score=35,
    ),
}

DEFAULT_WEATHER = WeatherRiskFactor(
    location="Destination",
    forecast="Fair weather conditions with minimal operational impact",
    temperature_c=25.0,
    precip_probability=20,
    severity_score=20,
)


def _normalize(text: str | None) -> str:
    if not text:
        return ""
    return text.lower().replace("(", " ").replace(")", " ").replace(",", " ").strip()


def get_historical_delay_rate(segment: Segment) -> float:
    loc_start = _normalize(segment.location_start)
    loc_end = _normalize(segment.location_end)

    for (orig, dest), rate in ROUTE_DELAY_DB.items():
        if orig in loc_start and dest in loc_end:
            return rate
        if orig in loc_end and dest in loc_start:
            return rate

    # Defaults based on segment type
    if segment.type == SegmentType.FLIGHT:
        return 24.0
    if segment.type == SegmentType.TRAIN:
        return 18.0
    if segment.type == SegmentType.TRANSFER:
        return 12.0
    return 8.0


def get_vendor_reliability(segment: Segment) -> Tuple[str, float]:
    name = segment.vendor_name or segment.name or ""
    lowered = _normalize(name)
    desc = _normalize(segment.description)

    for vendor, rel in VENDOR_RELIABILITY_DB.items():
        if vendor in lowered or vendor in desc:
            return vendor.title(), rel

    if segment.type == SegmentType.FLIGHT:
        return "Air Carrier", 80.0
    if segment.type == SegmentType.TRAIN:
        return "Rail Operator", 82.0
    if segment.type == SegmentType.HOTEL:
        return "Hospitality Vendor", 94.0
    return "Service Provider", 88.0


def get_weather_forecast(segment: Segment) -> WeatherRiskFactor:
    target = _normalize(segment.location_end or segment.location_start)
    for city, factor in WEATHER_FORECAST_DB.items():
        if city in target:
            return factor
    return DEFAULT_WEATHER


def calculate_segment_risk(segment: Segment) -> SegmentPredictiveRisk:
    delay_rate = get_historical_delay_rate(segment)
    vendor_name, vendor_reliability = get_vendor_reliability(segment)
    weather = get_weather_forecast(segment)

    # Core Formula:
    # risk_score = f(historical_delay_rate, weather_forecast, vendor_reliability)
    # Weights: 40% historical route delay rate + 35% weather severity + 25% vendor unreliability
    vendor_unreliability = max(0.0, 100.0 - vendor_reliability)
    raw_score = (0.40 * delay_rate) + (0.35 * weather.severity_score) + (0.25 * vendor_unreliability)
    score = max(5, min(95, int(round(raw_score))))

    if score < 35:
        band = "LOW"
        advisory = f"High reliability route ({vendor_reliability:.0f}% on-time). Normal buffer sufficient."
    elif score < 65:
        band = "MODERATE"
        advisory = f"Moderate delay risk detected on {segment.name} due to weather ({weather.forecast}). Ensure at least 60m buffer."
    else:
        band = "HIGH"
        advisory = f"Elevated delay probability ({delay_rate:.1f}% route history + severe weather). Pre-trip backup recommended."

    route_display = f"{segment.location_start or 'Origin'} → {segment.location_end or 'Destination'}"

    return SegmentPredictiveRisk(
        segment_id=segment.id,
        segment_name=segment.name,
        route=route_display,
        historical_delay_rate=round(delay_rate, 1),
        weather_factor=weather,
        vendor_name=vendor_name,
        vendor_reliability=round(vendor_reliability, 1),
        risk_score=score,
        risk_band=band,
        advisory=advisory,
    )


def calculate_itinerary_predictive_risk(itinerary: Itinerary) -> ItineraryPredictiveRisk:
    if not itinerary.segments:
        return ItineraryPredictiveRisk(
            itinerary_id=itinerary.id,
            overall_risk_score=10,
            overall_risk_band="LOW",
            summary="Empty itinerary with no active transit risks.",
            key_drivers=[],
            segment_risks=[],
        )

    segment_risks = [calculate_segment_risk(seg) for seg in itinerary.segments]

    # Overall score combines peak critical leg risk and average itinerary exposure
    scores = [sr.risk_score for sr in segment_risks]
    max_score = max(scores)
    avg_score = sum(scores) / len(scores)
    overall_score = int(round(0.60 * max_score + 0.40 * avg_score))

    if overall_score < 35:
        overall_band = "LOW"
        summary = "Favorable travel conditions across all legs. Low probability of cascading disruptions."
    elif overall_score < 65:
        overall_band = "MODERATE"
        summary = "Moderate pre-departure delay exposure identified. Weather conditions and route congestion warrant monitoring."
    else:
        overall_band = "HIGH"
        summary = "High pre-departure disruption vulnerability. Multiple critical legs face weather and vendor reliability headwinds."

    drivers = []
    high_risks = [sr for sr in segment_risks if sr.risk_score >= 50]
    for hr in high_risks[:3]:
        drivers.append(f"{hr.segment_name}: {hr.risk_score}/100 risk ({hr.weather_factor.forecast})")

    if not drivers:
        drivers.append("All segments currently report calm weather and standard on-time vendor rates.")

    return ItineraryPredictiveRisk(
        itinerary_id=itinerary.id,
        overall_risk_score=overall_score,
        overall_risk_band=overall_band,
        summary=summary,
        key_drivers=drivers,
        segment_risks=segment_risks,
    )
