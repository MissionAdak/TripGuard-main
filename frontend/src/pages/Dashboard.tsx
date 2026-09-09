import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Plus,
  Trash2,
  Plane,
  Pencil,
  Shield,
  CloudLightning,
  UploadCloud,
  Users,
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import {
  clearData,
  createItinerary,
  deleteItinerary,
  fetchItinerary,
  fetchPredictiveRisk,
  fetchResilience,
  listItineraries,
  simulateData,
  updateItinerary,
} from "../api/client";
import TripMap from "../components/TripMap";
import ImportBookingModal from "../components/ImportBookingModal";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "../components/ui/primitives";
import type { Itinerary, SegmentDraft, SegmentType } from "../types";

const TYPES: SegmentType[] = ["FLIGHT", "TRAIN", "TRANSFER", "HOTEL", "ACTIVITY"];

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function itineraryToDrafts(itinerary: Itinerary): SegmentDraft[] {
  const ordered = [...itinerary.segments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
  return ordered.map((segment) => ({
    type: segment.type,
    name: segment.name,
    description: segment.description || "",
    start_time: toLocalInput(new Date(segment.start_time)),
    end_time: toLocalInput(new Date(segment.end_time)),
    location_start: segment.location_start || "",
    location_end: segment.location_end || "",
    cost: String(segment.cost ?? 0),
    vendor_name: segment.vendor_name || "",
    vendor_source: segment.vendor_source || "Manual",
    booking_reference: segment.booking_reference || "",
  }));
}

function blankSegment(): SegmentDraft {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    type: "FLIGHT",
    name: "",
    description: "",
    start_time: toLocalInput(start),
    end_time: toLocalInput(end),
    location_start: "",
    location_end: "",
    cost: "0",
    vendor_name: "",
    vendor_source: "Manual",
    booking_reference: "",
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: trips = [], isLoading } = useQuery({ queryKey: ["itineraries"], queryFn: listItineraries });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId || trips[0]?.id;

  const { data: selectedTrip } = useQuery({
    queryKey: ["itinerary", activeId],
    queryFn: () => fetchItinerary(activeId!),
    enabled: Boolean(activeId),
  });

  const { data: predictiveRisk } = useQuery({
    queryKey: ["predictive-risk", activeId],
    queryFn: () => fetchPredictiveRisk(activeId!),
    enabled: Boolean(activeId),
  });

  const { data: resilience } = useQuery({
    queryKey: ["resilience", activeId],
    queryFn: () => fetchResilience(activeId!),
    enabled: Boolean(activeId),
  });

  const [tripName, setTripName] = useState("");
  const [travelerName, setTravelerName] = useState("");
  const [segments, setSegments] = useState<SegmentDraft[]>([blankSegment()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  function resetForm() {
    setEditingId(null);
    setTripName("");
    setTravelerName("");
    setSegments([blankSegment()]);
    setIsFormOpen(false);
  }

  function startEdit(itinerary: Itinerary) {
    const drafts = itineraryToDrafts(itinerary);
    setEditingId(itinerary.id);
    setTripName(itinerary.name);
    setTravelerName(itinerary.traveler_name);
    setSegments(drafts.length ? drafts : [blankSegment()]);
    setSelectedId(itinerary.id);
    setIsFormOpen(true);
    window.setTimeout(() => {
      document.getElementById("trip-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const simulateMutation = useMutation({
    mutationFn: simulateData,
    onSuccess: (saved) => {
      localStorage.setItem("tripguard-last-itin", saved.id);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.setQueryData(["itinerary", saved.id], saved);
      setSelectedId(saved.id);
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearData,
    onSuccess: () => {
      localStorage.removeItem("tripguard-last-itin");
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      setSelectedId(null);
      resetForm();
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createItinerary>[0]) =>
      editingId ? updateItinerary(editingId, payload) : createItinerary(payload),
    onSuccess: (saved) => {
      localStorage.setItem("tripguard-last-itin", saved.id);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.setQueryData(["itinerary", saved.id], saved);
      setSelectedId(saved.id);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItinerary,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.removeQueries({ queryKey: ["itinerary", deletedId] });
      if (editingId === deletedId) resetForm();
      if (selectedId === deletedId) setSelectedId(null);
    },
  });

  const stats = useMemo(() => {
    const disrupted = trips.filter((t) => t.status === "DISRUPTED" || t.status === "AT_RISK").length;
    return { trips: trips.length, legs: trips.reduce((sum, t) => sum + t.segment_count, 0), disrupted };
  }, [trips]);

  function updateSegment(index: number, patch: Partial<SegmentDraft>) {
    setSegments((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payloadSegments = segments
      .filter((s) => s.name.trim() && s.location_start.trim())
      .map((s) => ({
        ...s,
        start_time: new Date(s.start_time).toISOString(),
        end_time: new Date(s.end_time).toISOString(),
        cost: Number(s.cost) || 0,
      }));
    if (!tripName.trim() || !travelerName.trim() || payloadSegments.length === 0) return;
    saveMutation.mutate({
      name: tripName.trim(),
      traveler_name: travelerName.trim(),
      segments: payloadSegments,
    });
  }

  // FIRST OPEN / EMPTY STATE
  if (!isLoading && trips.length === 0) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto py-8">
        <div className="text-center space-y-3">
          <Badge className="bg-primary/20 text-primary border-primary/30 py-1 px-3 text-xs">
            TripGuard Proactive Resilience
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight">Travel Operations Center</h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
            Welcome to TripGuard. Pre-departure predictive risk modeling, true net cost ledgers, cross-vendor booking ingestion, and structural graph resilience.
          </p>
        </div>

        <Card className="border-primary/30 bg-gradient-to-b from-card via-card to-primary/5 shadow-2xl p-4 sm:p-8">
          <CardContent className="space-y-6 text-center pt-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary mx-auto flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">No Itineraries Loaded</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Start with a clean slate, or click the button below to simulate sample data to test all predictive and resilience features.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={() => simulateMutation.mutate()}
                disabled={simulateMutation.isPending}
                className="shadow-xl shadow-primary/25 h-12 px-6 text-sm font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {simulateMutation.isPending ? "Simulating Trip..." : "⚡ Simulate Sample Data to Test"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setIsFormOpen((prev) => !prev)}
                className="h-12 px-5 text-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {isFormOpen ? "Hide Form" : "Create Manual Itinerary"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Optional Manual Entry when user toggles it */}
        {isFormOpen && (
          <Card id="trip-editor" className="border-border">
            <CardHeader>
              <CardTitle>Manual Trip Creation</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-sm space-y-1">
                    <span>Trip name</span>
                    <input
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                      value={tripName}
                      onChange={(e) => setTripName(e.target.value)}
                      placeholder="e.g. Mumbai to Delhi Express"
                      required
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span>Traveler name</span>
                    <input
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                      value={travelerName}
                      onChange={(e) => setTravelerName(e.target.value)}
                      placeholder="e.g. Priya Shah"
                      required
                    />
                  </label>
                </div>

                {segments.map((segment, index) => (
                  <div key={index} className="rounded-lg border border-border p-3.5 space-y-3 bg-secondary/10">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Segment {index + 1}</p>
                      {segments.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setSegments((rows) => rows.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3"
                        value={segment.type}
                        onChange={(e) => updateSegment(index, { type: e.target.value as SegmentType })}
                      >
                        {TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 md:col-span-2"
                        placeholder="Segment Name (e.g. Air India AI-101)"
                        value={segment.name}
                        onChange={(e) => updateSegment(index, { name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3"
                        placeholder="From: Mumbai (BOM)"
                        value={segment.location_start}
                        onChange={(e) => updateSegment(index, { location_start: e.target.value })}
                        required
                      />
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3"
                        placeholder="To: Delhi (DEL)"
                        value={segment.location_end}
                        onChange={(e) => updateSegment(index, { location_end: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="datetime-local"
                        className="h-10 rounded-md border border-input bg-background px-3"
                        value={segment.start_time}
                        onChange={(e) => updateSegment(index, { start_time: e.target.value })}
                        required
                      />
                      <input
                        type="datetime-local"
                        className="h-10 rounded-md border border-input bg-background px-3"
                        value={segment.end_time}
                        onChange={(e) => updateSegment(index, { end_time: e.target.value })}
                        required
                      />
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3"
                        placeholder="Cost (₹)"
                        value={segment.cost}
                        onChange={(e) => updateSegment(index, { cost: e.target.value })}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setSegments((rows) => [...rows, blankSegment()])}>
                    <Plus className="w-4 h-4 mr-2" /> Add segment
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : "Save Trip"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ACTIVE DASHBOARD WHEN DATA EXISTS
  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary font-semibold">Proactive Resilience Operations</p>
          <h1 className="text-3xl font-bold mt-1">Dashboard</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs sm:text-sm">
            Predictive risk modeling, structural graph resilience, and cross-vendor external bookings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => simulateMutation.mutate()}
            disabled={simulateMutation.isPending}
            className="shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {simulateMutation.isPending ? "Simulating..." : "⚡ Simulate Sample Data"}
          </Button>

          {activeId && (
            <Button size="sm" variant="outline" onClick={() => setIsImportModalOpen(true)}>
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Ingest Booking
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetForm();
              setIsFormOpen((prev) => !prev);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Trip
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => clearAllMutation.mutate()}
            disabled={clearAllMutation.isPending}
            className="text-muted-foreground hover:text-destructive text-xs"
            title="Clear all trips and start fresh"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Data
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trips</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.trips}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Segments</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.legs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-Trip Risk</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold">
                {predictiveRisk ? `${predictiveRisk.overall_risk_score}/100` : "--"}
              </span>
              {predictiveRisk && (
                <Badge
                  className={
                    predictiveRisk.overall_risk_band === "LOW"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"
                      : predictiveRisk.overall_risk_band === "MODERATE"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]"
                      : "bg-destructive/20 text-destructive border-destructive/30 text-[10px]"
                  }
                >
                  {predictiveRisk.overall_risk_band}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resilience Score</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold">
                {resilience ? `${resilience.resilience_score}/100` : "--"}
              </span>
              {resilience && (
                <Badge variant="outline" className="text-[10px]">
                  {resilience.spof_count} SPOF{resilience.spof_count === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature 1 & Feature 4: Pre-Departure Risk & Resilience Panels */}
      {selectedTrip && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CloudLightning className="w-4 h-4 text-primary" /> Pre-Departure Predictive Risk
                </CardTitle>
                <Badge className="bg-primary/20 text-primary font-mono text-xs">
                  {predictiveRisk?.overall_risk_score ?? 35}/100 Risk
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                f(route delay rate, destination meteorology, vendor reliability)
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                {predictiveRisk?.summary || "Analyzing route delay metrics and destination weather."}
              </p>
              <div className="space-y-1.5">
                {predictiveRisk?.key_drivers.map((driver, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded bg-secondary/40">
                    <span className="text-primary font-bold">▪</span>
                    <span>{driver}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> Structural Resilience & SPOFs
                </CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-400 font-mono text-xs">
                  {resilience?.resilience_score ?? 74}/100 ({resilience?.resilience_rating ?? "Moderate"})
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Graph dependency analysis detecting critical bottlenecks without fallbacks
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {resilience && resilience.spofs.length > 0 ? (
                <div className="space-y-2">
                  {resilience.spofs.map((spof, idx) => (
                    <div key={idx} className="p-2.5 rounded border border-amber-500/20 bg-amber-500/5 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">{spof.segment_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {spof.buffer_minutes}m buffer · {spof.cascading_target_count} cascaded legs
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{spof.description}</p>
                      <p className="text-primary text-[11px] font-medium">💡 Advice: {spof.recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>All sequential buffers meet resilience safety margins.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map & Itineraries Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4 text-primary" /> Route Map
            </CardTitle>
            {selectedTrip?.group_info?.is_group && (
              <Badge className="bg-primary/20 text-primary flex items-center gap-1 text-xs">
                <Users className="w-3 h-3" /> Party of {selectedTrip.group_info.party_size}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <TripMap key={selectedTrip?.id || "empty"} itinerary={selectedTrip} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Saved Itineraries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className={`rounded-lg border p-3.5 transition-all ${
                  trip.id === activeId ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-border/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button className="text-left flex-1" onClick={() => setSelectedId(trip.id)}>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{trip.name}</p>
                      {trip.group_size > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" /> {trip.group_size}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {trip.traveler_name} · {trip.segment_count} segments
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5">
                    {trip.resilience_score && (
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                        {trip.resilience_score}/100 Res
                      </span>
                    )}
                    <Badge>{trip.status}</Badge>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  {trip.locations.join(" → ") || "No locations"}
                </p>

                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    onClick={() => {
                      localStorage.setItem("tripguard-last-itin", trip.id);
                      navigate(`/operations/${trip.id}`);
                    }}
                  >
                    <Plane className="w-3 h-3 mr-1" /> Operations
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      localStorage.setItem("tripguard-last-itin", trip.id);
                      navigate(`/traveler/${trip.id}`);
                    }}
                  >
                    Traveler view
                  </Button>
                  <Button
                    size="sm"
                    variant={editingId === trip.id ? "default" : "outline"}
                    onClick={async () => {
                      const full = trip.id === selectedTrip?.id ? selectedTrip : await fetchItinerary(trip.id);
                      startEdit(full);
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> {editingId === trip.id ? "Editing" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(trip.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Streamlined Collapsible Trip Editor */}
      {isFormOpen && (
        <Card id="trip-editor">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? `Edit trip · ${editingId}` : "Manual trip entry"}</CardTitle>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm space-y-1">
                  <span>Trip name</span>
                  <input
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    placeholder="Golden Triangle Tour"
                    required
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span>Traveler name</span>
                  <input
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                    value={travelerName}
                    onChange={(e) => setTravelerName(e.target.value)}
                    placeholder="Priya Shah & Group"
                    required
                  />
                </label>
              </div>

              {segments.map((segment, index) => (
                <div key={index} className="rounded-lg border border-border p-3.5 space-y-3 bg-secondary/10">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Segment {index + 1}</p>
                    {segments.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSegments((rows) => rows.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3"
                      value={segment.type}
                      onChange={(e) => updateSegment(index, { type: e.target.value as SegmentType })}
                    >
                      {TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 rounded-md border border-input bg-background px-3 md:col-span-2"
                      placeholder="Flight Mumbai to Delhi"
                      value={segment.name}
                      onChange={(e) => updateSegment(index, { name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      className="h-10 rounded-md border border-input bg-background px-3"
                      placeholder="From: Mumbai (BOM)"
                      value={segment.location_start}
                      onChange={(e) => updateSegment(index, { location_start: e.target.value })}
                      required
                    />
                    <input
                      className="h-10 rounded-md border border-input bg-background px-3"
                      placeholder="To: Delhi (DEL)"
                      value={segment.location_end}
                      onChange={(e) => updateSegment(index, { location_end: e.target.value })}
                      required
                    />
                    <input
                      className="h-10 rounded-md border border-input bg-background px-3"
                      placeholder="Vendor (Air India, Booking.com...)"
                      value={segment.vendor_name || ""}
                      onChange={(e) => updateSegment(index, { vendor_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="datetime-local"
                      className="h-10 rounded-md border border-input bg-background px-3"
                      value={segment.start_time}
                      onChange={(e) => updateSegment(index, { start_time: e.target.value })}
                      required
                    />
                    <input
                      type="datetime-local"
                      className="h-10 rounded-md border border-input bg-background px-3"
                      value={segment.end_time}
                      onChange={(e) => updateSegment(index, { end_time: e.target.value })}
                      required
                    />
                    <input
                      className="h-10 rounded-md border border-input bg-background px-3"
                      placeholder="Cost (₹)"
                      value={segment.cost}
                      onChange={(e) => updateSegment(index, { cost: e.target.value })}
                    />
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setSegments((rows) => [...rows, blankSegment()])}>
                  <Plus className="w-4 h-4 mr-2" /> Add segment
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingId ? "Update trip" : "Save trip"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Import Booking Modal */}
      {activeId && (
        <ImportBookingModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          itinId={activeId}
        />
      )}
    </div>
  );
}
