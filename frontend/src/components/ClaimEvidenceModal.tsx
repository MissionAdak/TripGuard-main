import { useState } from "react";
import { X, ShieldCheck, Download, Printer, FileText, CheckCircle2, Clock, Landmark } from "lucide-react";
import { Button, Badge } from "./ui/primitives";
import type { ClaimEvidenceBundle } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bundle: ClaimEvidenceBundle | null;
  isLoading: boolean;
}

export default function ClaimEvidenceModal({ isOpen, onClose, bundle, isLoading }: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  function handlePrint() {
    window.print();
  }

  function handleDownloadJSON() {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.claim_id}_Evidence_Bundle.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyCertificate() {
    if (!bundle) return;
    navigator.clipboard.writeText(bundle.carrier_delay_certificate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Insurance & Disruption Claim Bundle</h3>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  AirHelp-Grade Verified
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Official automated proof packet for airline passenger charters & travel insurers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto print:p-0">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Compiling cryptographic evidence dossier...</p>
            </div>
          ) : !bundle ? (
            <p className="text-sm text-muted-foreground">No disruption claim data available for this trip.</p>
          ) : (
            <>
              {/* Dossier Meta Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-secondary/50 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block">Claim Dossier ID</span>
                  <span className="font-mono font-bold text-primary">{bundle.claim_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Disruption Length</span>
                  <span className="font-bold text-destructive">{bundle.delay_duration_minutes} min delay</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Operating Carrier</span>
                  <span className="font-bold">{bundle.carrier_vendor}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Verification Hash</span>
                  <span className="font-mono text-muted-foreground truncate block" title={bundle.verification_hash}>
                    {bundle.verification_hash}
                  </span>
                </div>
              </div>

              {/* Chronological Timeline Proof */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Chronological Flight & Service Proof
                </h4>
                <div className="rounded-lg border border-border p-4 bg-background/50 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Disrupted Service:</span>
                    <span className="font-semibold">{bundle.disrupted_segment_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Scheduled Departure:</span>
                    <span className="font-mono">{new Date(bundle.scheduled_departure).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Actual / Rescheduled Departure:</span>
                    <span className="font-mono text-destructive">{new Date(bundle.actual_departure).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Recorded Disruption Root Cause:</span>
                    <span>{bundle.reason}</span>
                  </div>
                </div>
              </div>

              {/* Statutory Passenger Rights & Claim Eligibility */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" /> Passenger Charter & Insurance Entitlements
                </h4>
                <div className="space-y-2">
                  {bundle.applicable_regulations.map((reg, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-border bg-secondary/30 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-primary">{reg.regulation_code}</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Est. Payout: ₹{reg.estimated_statutory_payout.toFixed(2)}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium">{reg.entitlement}</p>
                      <p className="text-[11px] text-muted-foreground">{reg.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Itemized Financial Loss Statement */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Itemized Loss Statement
                  </h4>
                  <span className="text-xs font-bold text-destructive">
                    Total Claimed: ₹{bundle.total_claimed_amount.toFixed(2)}
                  </span>
                </div>
                <div className="rounded-lg border border-border overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-secondary/60 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Receipt Ref</th>
                        <th className="p-2.5 text-right">Claimable Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bundle.itemized_losses.map((item, idx) => (
                        <tr key={idx} className="hover:bg-secondary/20">
                          <td className="p-2.5 font-medium">{item.category}</td>
                          <td className="p-2.5 text-muted-foreground">{item.description}</td>
                          <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{item.receipt_reference}</td>
                          <td className="p-2.5 text-right font-bold text-destructive">
                            ₹{item.net_loss.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Official Carrier Delay Certificate Statement */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Certified Carrier Delay Statement
                  </h4>
                  <button
                    onClick={handleCopyCertificate}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    {copied ? "Copied" : "Copy Statement"}
                  </button>
                </div>
                <pre className="p-3.5 rounded-lg bg-black/60 border border-border text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {bundle.carrier_delay_certificate}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!bundle}>
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Dossier
            </Button>
            <Button size="sm" onClick={handleDownloadJSON} disabled={!bundle}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download Evidence (.json)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
