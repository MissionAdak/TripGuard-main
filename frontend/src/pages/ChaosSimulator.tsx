import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchItinerary,
  disruptItinerary,
  getRecoveryPlans,
  applyRecoveryPlan,
  resetItinerary,
  listItineraries,
  fetchClaimEvidence,
  fetchTravelerPreferences,
  simulateData,
} from "../api/client";
import DependencyGraph from "../components/DependencyGraph";
import TripMap from "../components/TripMap";
import NetCostLedgerModal from "../components/NetCostLedgerModal";
import ClaimEvidenceModal from "../components/ClaimEvidenceModal";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from "../components/ui/primitives";
import {
  AlertTriangle,
  RefreshCw,
  Zap,
  IndianRupee,
  ShieldCheck,
  Users,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecoveryPlan } from "../types";

export default function ChaosSimulator() {
  const { itinId } = useParams();
  const stored = typeof window !== "undefined" ? localStorage.getItem("tripguard-last-itin") : null;
  const queryClient = useQueryClient();
  const { data: trips = [] } = useQuery({ queryKey: ["itineraries"], queryFn: listItineraries });
  const activeId = itinId || stored || trips[0]?.id;
  const [showRecovery, setShowRecovery] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(180);
  const [segmentId, setSegmentId] = useState("");

  // Modals state
  const [selectedLedgerPlan, setSelectedLedgerPlan] = useState<RecoveryPlan | null>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  const { data: itinerary, isLoading, error } = useQuery({
    queryKey: ["itinerary", activeId],
    queryFn: () => fetchItinerary(activeId!),
    enabled: Boolean(activeId),
  });

  const { data: recoveryData, isLoading: isLoadingRecovery, refetch: fetchPlans } = useQuery({
    queryKey: ["recovery", activeId],
    queryFn: () => getRecoveryPlans(activeId!),
    enabled: false,
  });

  const { data: travelerPrefs } = useQuery({
    queryKey: ["traveler-preferences"],
    queryFn: fetchTravelerPreferences,
  });

  const { data: claimBundle, isLoading: isLoadingClaim } = useQuery({
    queryKey: ["claim-evidence", activeId],
    queryFn: () => fetchClaimEvidence(activeId!),
    enabled: isClaimModalOpen && Boolean(activeId),
  });

  const currentSegment = segmentId || itinerary?.segments[0]?.id || "";

  const disruptMutation = useMutation({
    mutationFn: () => disruptItinerary(activeId!, currentSegment, delayMinutes),
    onSuccess: (updatedItinerary) => {
      queryClient.setQueryData(["itinerary", activeId], updatedItinerary);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      setShowRecovery(true);
      fetchPlans();
    },
  });

  const applyPlanMutation = useMutation({
    mutationFn: (planId: string) => applyRecoveryPlan(activeId!, planId),
    onSuccess: (updatedItinerary) => {
      queryClient.setQueryData(["itinerary", activeId], updatedItinerary);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["traveler-preferences"] });
      setShowRecovery(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetItinerary(activeId!),
    onSuccess: (updatedItinerary) => {
      queryClient.setQueryData(["itinerary", activeId], updatedItinerary);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      setShowRecovery(false);
    },
  });

  const simulateMutation = useMutation({
    mutationFn: simulateData,
    onSuccess: (saved) => {
      localStorage.setItem("tripguard-last-itin", saved.id);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.setQueryData(["itinerary", saved.id], saved);
    },
  });

  if (!activeId) {
    return (
      <Card className="max-w-xl mx-auto my-12 text-center p-6 border-primary/20">
        <CardContent className="space-y-4 pt-2">
          <h1 className="text-2xl font-bold">Operations - No Active Trip</h1>
          <p className="text-muted-foreground text-sm">
            The simulator requires an itinerary to inject disruptions and evaluate recovery plans.
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

  if (isLoading) return <div className="p-8 text-center">Loading trip {activeId}...</div>;
  if (error || !itinerary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>This trip was not found. Create one from the dashboard.</p>
          <Link className="text-primary underline" to="/">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm uppercase tracking-widest text-primary font-semibold">Resilience Operations</p>
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
          <h1 className="text-3xl font-bold flex items-center gap-2 mt-1">
            <Zap className="text-primary" /> {itinerary.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {itinerary.traveler_name} · {itinerary.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block mb-1 text-muted-foreground">Segment to disrupt</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 min-w-[200px]"
              value={currentSegment}
              onChange={(e) => setSegmentId(e.target.value)}
            >
              {itinerary.segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name} ({segment.type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-muted-foreground">Delay (min)</span>
            <input
              type="number"
              min={15}
              className="h-10 w-24 rounded-md border border-input bg-background px-3"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Number(e.target.value) || 0)}
            />
          </label>
          <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${resetMutation.isPending ? "animate-spin" : ""}`} /> Reset
          </Button>
          <Button
            variant="destructive"
            onClick={() => disruptMutation.mutate()}
            disabled={disruptMutation.isPending || showRecovery}
          >
            <AlertTriangle className="w-4 h-4 mr-2" /> Inject Disruption
          </Button>
        </div>
      </div>

      {/* Feature 5: Traveler Preference Learning Banner */}
      {travelerPrefs && (
        <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="font-semibold text-foreground">
                Adaptive Preference Model: {travelerPrefs.dominant_preference} Traveler
              </span>
              <p className="text-muted-foreground mt-0.5">{travelerPrefs.insight}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground shrink-0">
            <span>Choices:</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary">Balanced: {travelerPrefs.choices_count.balanced}</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary">Cheapest: {travelerPrefs.choices_count.cheapest}</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary">Fastest: {travelerPrefs.choices_count.fastest}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Live dependency graph</h2>
          <DependencyGraph itinerary={itinerary} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Route map</h2>
          <TripMap key={`${itinerary.id}-${itinerary.segments.map((s) => s.status).join()}`} itinerary={itinerary} />
        </div>
      </div>

      <AnimatePresence>
        {showRecovery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /> Disruption injected ({delayMinutes}m delay). Downstream blast radius computed.
              </div>
              {/* Feature 6: AirHelp Claim Evidence Button */}
              <Button
                size="sm"
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10 shadow-sm"
                onClick={() => setIsClaimModalOpen(true)}
              >
                <ShieldCheck className="w-4 h-4 mr-1.5" /> Auto-Compile AirHelp Claim Bundle
              </Button>
            </div>

            {isLoadingRecovery ? (
              <div className="p-8 text-center animate-pulse bg-secondary/50 rounded-lg">
                Calculating recovery plans and true net ledgers...
              </div>
            ) : recoveryData ? (
              <div className="space-y-6">
                {recoveryData.explanation && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Zap className="w-5 h-5 text-primary" /> Recommended Resolution Strategy
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="font-semibold text-sm">{recoveryData.explanation.summary}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {recoveryData.explanation.reason}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {recoveryData.explanation.actions.map((act, i) => (
                          <Badge key={i} variant="outline" className="text-[11px] font-sans">
                            {act}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recoveryData.plans.map((plan) => {
                    const isRec = plan.id === recoveryData.explanation?.recommended_plan_id;
                    const netCost = plan.net_cost_ledger?.net_out_of_pocket ?? plan.cost_change;
                    const isCredit = netCost <= 0;

                    return (
                      <Card
                        key={plan.id}
                        className={`flex flex-col transition-all relative overflow-hidden ${
                          isRec ? "border-primary shadow-lg shadow-primary/10" : "border-border"
                        }`}
                      >
                        {isRec && (
                          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-bl-lg uppercase tracking-wider">
                            Recommended
                          </div>
                        )}

                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start gap-2">
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                          </div>
                          <p className="text-xs text-muted-foreground">{plan.description}</p>

                          {/* Feature 5: Personalization Tag */}
                          {plan.personalization_tag && (
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] w-fit mt-1">
                              ⭐ {plan.personalization_tag}
                            </Badge>
                          )}
                        </CardHeader>

                        <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-3">
                            {/* Feature 2: True Net-Cost Highlight Box */}
                            <div className="p-3 rounded-lg border border-border bg-secondary/40 space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">True Net Out-Of-Pocket:</span>
                                <span className={`font-mono font-bold text-base ${isCredit ? "text-emerald-400" : "text-destructive"}`}>
                                  {netCost < 0 ? "-" : ""}₹{Math.abs(netCost).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>Rebook Fare: ₹{plan.net_cost_ledger.new_cost.toFixed(2)}</span>
                                <span className="text-emerald-400">Refund: -₹{plan.net_cost_ledger.refund_owed.toFixed(2)}</span>
                              </div>
                              <button
                                onClick={() => setSelectedLedgerPlan(plan)}
                                className="w-full text-center text-[11px] text-primary hover:underline font-medium pt-1 flex items-center justify-center gap-1"
                              >
                                <IndianRupee className="w-3 h-3" /> View True Net Ledger
                              </button>
                            </div>

                            {/* Feature 7: Group Impact Indicator */}
                            {itinerary.group_info?.is_group && (
                              <div
                                className={`p-2.5 rounded-md border text-xs flex items-start gap-2 ${
                                  plan.group_impact.split_risk
                                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                }`}
                              >
                                <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span className="text-[11px] leading-snug">{plan.group_impact.description}</span>
                              </div>
                            )}

                            <div className="space-y-1.5 text-xs pt-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Time delta:</span>
                                <span className="font-medium">+{plan.time_change_minutes} min</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Resilience Score:</span>
                                <span className="font-semibold text-primary">{plan.score.total}/100</span>
                              </div>
                            </div>
                          </div>

                          <Button
                            className="w-full"
                            variant={isRec ? "default" : "outline"}
                            onClick={() => applyPlanMutation.mutate(plan.id)}
                            disabled={applyPlanMutation.isPending}
                          >
                            {applyPlanMutation.isPending ? "Applying..." : `Apply ${plan.name} Plan`}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature 2: Net Cost Ledger Breakdown Modal */}
      {selectedLedgerPlan && (
        <NetCostLedgerModal
          isOpen={Boolean(selectedLedgerPlan)}
          onClose={() => setSelectedLedgerPlan(null)}
          planName={selectedLedgerPlan.name}
          ledger={selectedLedgerPlan.net_cost_ledger}
        />
      )}

      {/* Feature 6: AirHelp-Grade Claim Evidence Modal */}
      <ClaimEvidenceModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        bundle={claimBundle || null}
        isLoading={isLoadingClaim}
      />
    </div>
  );
}
