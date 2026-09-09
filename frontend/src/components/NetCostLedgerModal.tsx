import { X, IndianRupee, ShieldCheck } from "lucide-react";
import { Button } from "./ui/primitives";
import type { NetCostLedger } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  ledger: NetCostLedger;
}

export default function NetCostLedgerModal({ isOpen, onClose, planName, ledger }: Props) {
  if (!isOpen) return null;

  const isNetCredit = ledger.net_out_of_pocket <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">True Net-Cost Ledger</h3>
              <p className="text-xs text-muted-foreground">{planName} Recovery Option</p>
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
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground leading-relaxed">
            Unlike standard booking sites that only show the raw replacement fare, TripGuard's Net Ledger
            accounts for mandated carrier refunds, schedule change waivers, and statutory insurance claims.
          </div>

          {/* Mathematical Ledger Breakdown */}
          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
              <span className="text-muted-foreground font-sans">New Rebooking Cost:</span>
              <span className="font-bold">₹{ledger.new_cost.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400">
              <span className="font-sans">(-) Carrier Refund / Credit Owed:</span>
              <span className="font-bold">-₹{ledger.refund_owed.toFixed(2)}</span>
            </div>

            {ledger.cancellation_penalty > 0 && (
              <div className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                <span className="font-sans">(+) Cancellation / Admin Penalty:</span>
                <span className="font-bold">+₹{ledger.cancellation_penalty.toFixed(2)}</span>
              </div>
            )}

            {ledger.insurance_claimable > 0 && (
              <div className="flex items-center justify-between p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <span className="font-sans">(-) Insurance & Delay Benefit:</span>
                <span className="font-bold">-₹{ledger.insurance_claimable.toFixed(2)}</span>
              </div>
            )}

            {/* Total Line */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                isNetCredit
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                  : "bg-destructive/10 border-destructive/40 text-foreground"
              }`}
            >
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold font-sans">True Net Out-Of-Pocket</p>
                <p className="text-xs font-sans opacity-75">
                  {isNetCredit ? "Net credit balance remaining to traveler" : "Actual final cost after claims"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black">
                  {ledger.net_out_of_pocket < 0 ? "-" : ""}₹{Math.abs(ledger.net_out_of_pocket).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Audit Notes */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audit Trail & Notes</h4>
            <div className="space-y-1.5">
              {ledger.breakdown_notes.map((note, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-secondary/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Ledger
          </Button>
        </div>
      </div>
    </div>
  );
}
