import { useState } from "react";
import { X, Mail, Sparkles, Building, Compass, Plane, CheckCircle2 } from "lucide-react";
import { Button, Badge } from "./ui/primitives";
import { importBooking } from "../api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itinId: string;
}

const PRESETS = [
  {
    id: "booking_hotel",
    label: "Booking.com Hotel",
    icon: Building,
    badge: "Booking.com",
    title: "The Oberoi Grand, Kolkata (Conf #BK-99281)",
    cost: "₹180.00",
  },
  {
    id: "airbnb_villa",
    label: "Airbnb Villa",
    icon: Building,
    badge: "Airbnb",
    title: "Royal Heritage Haveli & Spa, Jaipur",
    cost: "₹140.00",
  },
  {
    id: "viator_tour",
    label: "Viator Tour",
    icon: Compass,
    badge: "Viator",
    title: "Amber Fort Private Heritage Walking Tour",
    cost: "₹45.00",
  },
  {
    id: "expedia_flight",
    label: "Expedia Flight",
    icon: Plane,
    badge: "Expedia",
    title: "IndiGo Flight 6E-2041 (DEL → BLR)",
    cost: "₹115.00",
  },
];

export default function ImportBookingModal({ isOpen, onClose, itinId }: Props) {
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<string>("booking_hotel");
  const [useCustomText, setUseCustomText] = useState(false);
  const [rawText, setRawText] = useState("");
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: () =>
      importBooking(itinId, {
        template_preset: useCustomText ? undefined : selectedPreset,
        raw_text: useCustomText ? rawText : undefined,
      }),
    onSuccess: (result) => {
      setImportSuccess(
        `Added "${result.parsed_segment.name}" from ${result.source_vendor} (Ref: ${result.booking_reference}) into graph!`
      );
      queryClient.invalidateQueries({ queryKey: ["itinerary", itinId] });
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["resilience", itinId] });
      queryClient.invalidateQueries({ queryKey: ["predictive-risk", itinId] });
      setTimeout(() => {
        setImportSuccess(null);
        onClose();
      }, 1800);
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">Import External Booking</h3>
              <p className="text-xs text-muted-foreground">Vendor-agnostic confirmation ingestion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            TripGuard ingests external reservations like TripIt does. Select a realistic confirmation email preset or
            paste raw confirmation email text from Booking.com, Airbnb, Viator, or Expedia.
          </p>

          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-secondary/60 p-1 text-xs font-medium">
            <button
              onClick={() => setUseCustomText(false)}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                !useCustomText ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Preset Email Confirmations
            </button>
            <button
              onClick={() => setUseCustomText(true)}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                useCustomText ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Paste Custom Email Text
            </button>
          </div>

          {!useCustomText ? (
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Select Confirmation Preset
              </label>
              <div className="grid grid-cols-1 gap-2">
                {PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset.id)}
                      className={`cursor-pointer p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-secondary/20 hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center ${
                            isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">{preset.badge}</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {preset.cost}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">{preset.title}</p>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Forwarded Email / Confirmation Text
              </label>
              <textarea
                rows={5}
                className="w-full rounded-md border border-input bg-background p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Paste confirmation email text (e.g. Booking.com reference, check-in dates, hotel name, fare)..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </div>
          )}

          {/* Success message banner */}
          {importSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importSuccess}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-secondary/20 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={importMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || Boolean(importSuccess) || (useCustomText && !rawText.trim())}
          >
            {importMutation.isPending ? (
              "Ingesting..."
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Ingest & Link to Graph
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
