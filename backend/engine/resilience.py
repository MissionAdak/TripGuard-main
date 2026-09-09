"""
Itinerary Resilience and Single-Point-of-Failure (SPOF) Engine.

Calculates pre-trip structural resilience:
  - Identifies single dependencies that cascade into multiple downstream cancellations
  - Analyzes tight buffers (< 45 minutes)
  - Scores itinerary structural toughness out of 100
"""

from typing import List, Dict
from models import (
    Itinerary,
    ResilienceAnalysis,
    SinglePointOfFailure,
)


def calculate_itinerary_resilience(itinerary: Itinerary) -> ResilienceAnalysis:
    if not itinerary.segments:
        return ResilienceAnalysis(
            itinerary_id=itinerary.id,
            resilience_score=100,
            resilience_rating="Robust",
            spof_count=0,
            spofs=[],
            tight_buffers_count=0,
            recommendations=["Add trip segments to analyze dependency resilience."],
        )

    segments_map = {s.id: s for s in itinerary.segments}
    adj: Dict[str, List[str]] = {s.id: [] for s in itinerary.segments}
    buffer_map: Dict[str, int] = {}

    for dep in itinerary.dependencies:
        if dep.source_id in adj:
            adj[dep.source_id].append(dep.target_id)
        buffer_map[f"{dep.source_id}->{dep.target_id}"] = dep.buffer_minutes

    spofs: List[SinglePointOfFailure] = []
    tight_buffers_count = 0
    recommendations: List[str] = []

    # Calculate downstream blast radius using DFS
    def count_downstream(start_id: str) -> int:
        visited = set()
        stack = [start_id]
        while stack:
            curr = stack.pop()
            for neighbor in adj.get(curr, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    stack.append(neighbor)
        return len(visited)

    base_score = 100

    for dep in itinerary.dependencies:
        src = segments_map.get(dep.source_id)
        tgt = segments_map.get(dep.target_id)
        if not src or not tgt:
            continue

        buffer_min = dep.buffer_minutes
        blast_radius = count_downstream(dep.source_id)

        # Tight buffer penalty
        if buffer_min < 45:
            tight_buffers_count += 1
            penalty = 12 if buffer_min < 20 else 8
            base_score -= penalty

            # If tight buffer also has cascading downstream impact, it's a Single Point of Failure (SPOF)
            if blast_radius >= 2 or buffer_min < 30:
                severity = "HIGH" if blast_radius >= 3 or buffer_min < 20 else "MEDIUM"
                desc = (
                    f"'{src.name}' has only {buffer_min}m buffer before '{tgt.name}'. "
                    f"A slight delay will trigger a domino effect collapsing {blast_radius} downstream segments."
                )
                rec = (
                    f"Increase buffer between '{src.name}' and '{tgt.name}' from {buffer_min}m to at least 60m."
                )
                spofs.append(
                    SinglePointOfFailure(
                        segment_id=src.id,
                        segment_name=src.name,
                        buffer_minutes=buffer_min,
                        cascading_target_count=blast_radius,
                        severity=severity,
                        description=desc,
                        recommendation=rec,
                    )
                )
                recommendations.append(rec)

    # Penalty for total SPOFs
    base_score -= len(spofs) * 10

    # Ensure range 25 to 98
    final_score = max(25, min(98, base_score))

    if final_score >= 80:
        rating = "Robust"
    elif final_score >= 60:
        rating = "Moderate"
    else:
        rating = "Vulnerable"

    if not recommendations:
        recommendations.append("Buffer margins across all connections are well-spaced and resilient to moderate transit delays.")

    return ResilienceAnalysis(
        itinerary_id=itinerary.id,
        resilience_score=final_score,
        resilience_rating=rating,
        spof_count=len(spofs),
        spofs=spofs,
        tight_buffers_count=tight_buffers_count,
        recommendations=recommendations[:4],
    )
