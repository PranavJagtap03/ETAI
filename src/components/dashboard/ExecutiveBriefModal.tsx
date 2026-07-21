"use client";

import { X, FileText, AlertTriangle, Shield, Zap } from "lucide-react";
import { ThreatLevel, THREAT_COLORS } from "@/lib/config";

interface RiskAssessment {
  impacted_chokepoint: string;
  threat_level: ThreatLevel;
  risk_score: number;
  event_summary: string;
  recommended_action: string;
  affected_suppliers: string[];
  estimated_disruption_days: number;
  india_impact_severity: string;
}

interface ExecutiveBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioLabel: string;
  riskAssessment: RiskAssessment | null;
  executiveBrief: string;
  isGenerating: boolean;
  onGenerateBrief: () => void;
}

export function ExecutiveBriefModal({
  isOpen,
  onClose,
  scenarioLabel,
  riskAssessment,
  executiveBrief,
  isGenerating,
  onGenerateBrief,
}: ExecutiveBriefModalProps) {
  if (!isOpen) return null;

  const color = riskAssessment
    ? THREAT_COLORS[riskAssessment.threat_level]
    : "#1e3a8a";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: color + "15" }}
            >
              <FileText className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Executive Intelligence Brief
              </h2>
              <p className="text-xs text-slate-500">{scenarioLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Risk Assessment Summary */}
        {riskAssessment && (
          <div
            className="mx-5 mt-4 rounded-xl p-4 border grid grid-cols-2 gap-3"
            style={{
              backgroundColor: color + "08",
              borderColor: color + "30",
            }}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" style={{ color }} />
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color }}
                >
                  {riskAssessment.threat_level} Threat
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {riskAssessment.event_summary}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-white border border-slate-100 p-2">
                <div
                  className="text-xl font-extrabold font-mono-data"
                  style={{ color }}
                >
                  {(riskAssessment.risk_score * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500">Risk Score</div>
              </div>
              <div className="rounded-lg bg-white border border-slate-100 p-2">
                <div className="text-xl font-extrabold font-mono-data text-slate-800">
                  {riskAssessment.estimated_disruption_days}d
                </div>
                <div className="text-xs text-slate-500">Est. Duration</div>
              </div>
              <div className="col-span-2 rounded-lg bg-white border border-slate-100 p-2">
                <div className="text-xs text-slate-500 mb-0.5">
                  Impacted Chokepoint
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {riskAssessment.impacted_chokepoint.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brief Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {executiveBrief ? (
            <div className="prose prose-sm max-w-none">
              {executiveBrief.split("\n").map((line, i) => {
                if (line.startsWith("## ")) {
                  return (
                    <h3
                      key={i}
                      className="text-sm font-bold text-slate-800 mt-4 mb-2 flex items-center gap-2"
                    >
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      {line.replace("## ", "")}
                    </h3>
                  );
                }
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <p
                      key={i}
                      className="text-xs font-bold text-slate-700 mt-3 mb-1 uppercase tracking-wider"
                    >
                      {line.replace(/\*\*/g, "")}
                    </p>
                  );
                }
                if (line.startsWith("• ") || line.startsWith("- ")) {
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 mb-1.5 ml-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {line.slice(2)}
                      </p>
                    </div>
                  );
                }
                if (line.trim() === "") return <div key={i} className="h-1" />;
                return (
                  <p
                    key={i}
                    className="text-xs text-slate-700 leading-relaxed mb-1.5"
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: "#dbeafe" }}
              >
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                Generate Executive Brief
              </p>
              <p className="text-xs text-slate-500 max-w-xs">
                Use Google Gemini AI to generate a ministerial-level
                intelligence brief for this scenario.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100">
          <button
            onClick={onGenerateBrief}
            disabled={isGenerating}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating with Gemini…
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded bg-white/20 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">G</span>
                </div>
                {executiveBrief ? "Regenerate Brief" : "Generate with Gemini AI"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
