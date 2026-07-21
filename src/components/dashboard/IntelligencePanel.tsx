"use client";

import { useState, useCallback } from "react";
import { Zap, Brain, Shield, FileText, AlertTriangle } from "lucide-react";
import { SCENARIOS, ScenarioId, THREAT_COLORS, ThreatLevel } from "@/lib/config";

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

interface IntelligencePanelProps {
  activeScenario: ScenarioId;
  riskAssessment: RiskAssessment | null;
  onAnalyze: (text: string) => void;
  onOpenBrief: () => void;
  isAnalyzing: boolean;
}

const QUICK_SCENARIOS = [
  { label: "Hormuz Strike", text: "Iranian ballistic missile strikes near the Strait of Hormuz have caused VLCCs to divert. The corridor is effectively closed." },
  { label: "Houthi Attack", text: "Houthi forces launched drone attacks on oil tankers in the Red Sea near Bab-el-Mandeb, forcing major shipping companies to suspend transits." },
  { label: "Suez Grounding", text: "A container ship grounding has blocked the Suez Canal in both directions. Authorities estimate a 10-14 day clearance window." },
];

export function IntelligencePanel({ activeScenario, riskAssessment, onAnalyze, onOpenBrief, isAnalyzing }: IntelligencePanelProps) {
  const [text, setText] = useState("");

  const handleAnalyze = useCallback(() => {
    onAnalyze(text);
  }, [text, onAnalyze]);

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Quick scenarios */}
      <div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Quick Load</p>
        <div className="flex flex-col gap-1">
          {QUICK_SCENARIOS.map((s) => (
            <button
              key={s.label}
              onClick={() => setText(s.text)}
              className="text-left p-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-xs text-slate-600 hover:text-blue-700 font-medium"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <textarea
        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        rows={5}
        placeholder="Paste news or scenario text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !text.trim()}
        className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isAnalyzing ? (
          <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing…</>
        ) : (
          <><Zap className="w-3 h-3" />Analyze with Gemini</>
        )}
      </button>

      {/* Assessment result */}
      {riskAssessment ? (
        <div className="rounded-xl border p-3 flex flex-col gap-2" style={{
          background: THREAT_COLORS[riskAssessment.threat_level] + "08",
          borderColor: THREAT_COLORS[riskAssessment.threat_level] + "30",
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" style={{ color: THREAT_COLORS[riskAssessment.threat_level] }} />
              <span className="text-xs font-bold" style={{ color: THREAT_COLORS[riskAssessment.threat_level] }}>
                {riskAssessment.threat_level}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono-data font-bold text-slate-700">{(riskAssessment.risk_score * 100).toFixed(0)}%</span>
              <span className="text-slate-400">{riskAssessment.estimated_disruption_days}d est.</span>
            </div>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{riskAssessment.event_summary}</p>
          <div className="text-xs text-slate-500 font-medium">
            📍 {riskAssessment.impacted_chokepoint.replace(/_/g, " ")}
            &nbsp;·&nbsp; {riskAssessment.india_impact_severity}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center gap-2 text-slate-400">
          <Brain className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs">Run analysis to see Gemini threat assessment</span>
        </div>
      )}

      {/* Executive brief button */}
      <button
        onClick={onOpenBrief}
        className="w-full py-2 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
      >
        <FileText className="w-3.5 h-3.5" />
        Executive Brief
      </button>

      {/* Active scenario context */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
        <div className="text-xs text-slate-400 mb-1">Active Scenario</div>
        <div className="text-xs font-semibold text-slate-700">{SCENARIOS[activeScenario].label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{SCENARIOS[activeScenario].description}</div>
      </div>
    </div>
  );
}
