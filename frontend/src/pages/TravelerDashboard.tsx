import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  MapPin,
  Clock,
  User,
  Users,
  CloudLightning,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import {
  fetchClaimEvidence,
  fetchItinerary,
  fetchPredictiveRisk,
  listItineraries,
  simulateData,
} from "../api/client";
import TripMap from "../components/TripMap";
import ClaimEvidenceModal from "../components/ClaimEvidenceModal";
import ImportBookingModal from "../components/ImportBookingModal";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "../components/ui/primitives";

function formatWhen(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TravelerDashboard() {
  const { itinId } = useParams();
  const queryClient = useQueryClient();
  const stored = typeof window !== "undefined" ? localStorage.getItem("tripguard-last-itin") : null;
  const { data: trips = [] } = useQuery({ queryKey: ["itineraries"], queryFn: listItineraries });
  const activeId = itinId || stored || trips[0]?.id;

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const simulateMutation = useMutation({
    mutationFn: simulateData,
    onSuccess: (saved) => {
      localStorage.setItem("tripguard-last-itin", saved.id);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.setQueryData(["itinerary", saved.id], saved);
    },
  });

  const { data: itinerary, isLoading, error } = useQuery({
    queryKey: ["itinerary", activeId],
    queryFn: () => fetchItinerary(activeId!),
    enabled: Boolean(activeId),
  });

  const { data: predictiveRisk } = useQuery({
    queryKey: ["predictive-risk", activeId],
    queryFn: () => fetchPredictiveRisk(activeId!),
    enabled: Boolean(activeId),
  });

  const { data: claimBundle, isLoading: isLoadingClaim } = useQuery({
    queryKey: ["claim-evidence", activeId],
    queryFn: () => fetchClaimEvidence(activeId!),
    enabled: isClaimModalOpen && Boolean(activeId),
  });

  if (!activeId) {
    return (
      <Card className="max-w-xl mx-auto my-12 text-center p-6 border-primary/20">
        <CardContent className="space-y-4 pt-2">
          <h1 className="text-2xl font-bold">Traveler Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            No trip has been entered yet. Simulate sample data to view the live traveler itinerary and route map.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={() => simulateMutation.mutate()} disabled={simulateMutation.isPending}>
              ⚡ Simulate Sample Data to Test
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <p className="p-8 text-center">Loading traveler itinerary...</p>;
  if (error || !itinerary) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p>This trip is not available. Enter a trip from the dashboard.</p>
          <Link className="text-primary underline" to="/">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const isDisrupted = itinerary.segments.some((s) => s.status === "DISRUPTED" || s.status === "AT_RISK");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm uppercase tracking-widest text-primary font-semibold">Traveler View</p>
            {itinerary.group_info?.is_group && (
              <Badge className="bg-primary/20 text-primary text-xs flex items-center gap-1">
                <Users className="w-3 h-3" /> Party of {itinerary.group_info.party_size}
              </Badge>
            )}
            {itinerary.resilience_score && (
              <Badge variant="outline" className="text-xs font-mono">
                {itinerary.resilience_score}/100 Resilience
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mt-1">{itinerary.name}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <User className="w-4 h-4" /> {itinerary.traveler_name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
            <UploadCloud className="w-4 h-4 mr-1.5" /> Ingest Booking
          </Button>
          {isDisrupted && (
            <Button size="sm" variant="destructive" onClick={() => setIsClaimModalOpen(true)}>
              <ShieldCheck className="w-4 h-4 mr-1.5" /> File Insurance Claim Dossier
            </Button>
          )}
          <Link to={`/operations/${itinerary.id}`} className="text-sm text-primary hover:underline ml-2">
            Open in Operations →
          </Link>
        </div>
      </div>

      {/* Feature 1: Pre-Departure Predictive Risk & Travel Weather Advisory */}
      {predictiveRisk && (
        <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CloudLightning className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Pre-Departure Route & Weather Risk:</span>
              <Badge
                className={
                  predictiveRisk.overall_risk_band === "LOW"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-mono"
                    : predictiveRisk.overall_risk_band === "MODERATE"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30 font-mono"
                    : "bg-destructive/20 text-destructive border-destructive/30 font-mono"
                }
              >
                {predictiveRisk.overall_risk_score}/100 ({predictiveRisk.overall_risk_band} RISK)
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              f(historical delay, meteorology, vendor reliability)
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{predictiveRisk.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {predictiveRisk.segment_risks.slice(0, 3).map((sr) => (
              <div key={sr.segment_id} className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold truncate max-w-[150px]">{sr.segment_name}</span>
                  <span className="font-mono font-bold text-primary">{sr.risk_score}/100</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  <span>Vendor: {sr.vendor_name} ({sr.vendor_reliability}% on-time)</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate" title={sr.weather_factor.forecast}>
                  Weather: {sr.weather_factor.forecast}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Live Map & Waypoints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TripMap key={itinerary.id} itinerary={itinerary} height={460} />
            </CardContent>
          </Card>

          {/* Feature 7: Group Travel Party Members Card */}
          {itinerary.group_info?.is_group && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Traveling Party ({itinerary.group_info.party_size} Members)
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">
                    Policy: {itinerary.group_info.split_policy.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {itinerary.group_info.members.map((member) => (
                    <div
                      key={member.id}
                      className="p-2.5 rounded-lg border border-border bg-secondary/30 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium">{member.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{member.role}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Itinerary Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Your Itinerary</CardTitle>
            <span className="text-xs text-muted-foreground">{itinerary.segments.length} segments confirmed</span>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {itinerary.segments.map((segment) => (
              <div
                key={segment.id}
                className={`rounded-lg border p-4 space-y-2 transition-all ${
                  segment.status === "DISRUPTED"
                    ? "border-destructive bg-destructive/5"
                    : segment.status === "AT_RISK"
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{segment.name}</p>
                      {/* Feature 3: External Vendor Source Badge */}
                      {segment.vendor_source && segment.vendor_source !== "Manual" && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-primary border-primary/40">
                          {segment.vendor_source}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {segment.type} · {segment.location_start}{" "}
                      {segment.location_end ? `→ ${segment.location_end}` : ""}
                    </p>
                    {segment.booking_reference && (
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        Booking Ref: {segment.booking_reference}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      segment.status === "DISRUPTED"
                        ? "destructive"
                        : segment.status === "AT_RISK"
                        ? "outline"
                        : "secondary"
                    }
                  >
                    {segment.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground border-t border-border/40">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {formatWhen(segment.start_time)} – {formatWhen(segment.end_time)}
                  </span>
                  <span className="font-mono font-medium text-foreground">₹{segment.cost.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Feature 6: AirHelp-Grade Claim Evidence Modal */}
      <ClaimEvidenceModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        bundle={claimBundle || null}
        isLoading={isLoadingClaim}
      />

      {/* Feature 3: Import Booking Modal */}
      <ImportBookingModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        itinId={activeId}
      />
    </div>
  );
}
