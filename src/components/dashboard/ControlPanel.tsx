"use client";

import { SCENARIOS, ScenarioId, THREAT_COLORS } from "@/lib/config";
import {
  AlertTriangle,
  Anchor,
  Ship,
  Globe,
  Waves,
  Zap,
  ChevronRight,
} from "lucide-react";

interface ControlPanelProps {
  activeScenario: ScenarioId;
  onScenarioChange: (id: ScenarioId) => void;
  isSimulating: boolean;
  // kept for compatibility but unused on this tab now
  newsText?: string;
  onNewsTextChange?: (text: string) => void;
  onAnalyzeNews?: () => void;
  isAnalyzing?: boolean;
}

const SCENARIO_ICONS: Record<ScenarioId, React.ReactNode> = {
  BASELINE: <Globe className="w-4 h-4" />,
  HORMUZ_SHUTDOWN: <Anchor className="w-4 h-4" />,
  RED_SEA_ESCALATION: <Waves className="w-4 h-4" />,
  SUEZ_DISRUPTION: <Ship className="w-4 h-4" />,
  DUAL_CHOKEPOINT: <Zap className="w-4 h-4" />,
};

const THREAT_BG: Record<string, string> = {
  LOW: "hover:border-emerald-300 hover:bg-emerald-50/50",
  MEDIUM: "hover:border-amber-300 hover:bg-amber-50/50",
  HIGH: "hover:border-orange-300 hover:bg-orange-50/50",
  CRITICAL: "hover:border-rose-300 hover:bg-rose-50/50",
};

const THREAT_ACTIVE: Record<string, string> = {
  LOW: "border-emerald-400 bg-emerald-50 shadow-emerald-100",
  MEDIUM: "border-amber-400 bg-amber-50 shadow-amber-100",
  HIGH: "border-orange-400 bg-orange-50 shadow-orange-100",
  CRITICAL: "border-rose-400 bg-rose-50 shadow-rose-100",
};

export function ControlPanel({
  activeScenario,
  onScenarioChange,
  isSimulating,
}: ControlPanelProps) {
  return (
    <div className="kavach-card p-4 flex flex-col gap-3">
      {/* Title */}
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-slate-600" />
        <h2 className="text-sm font-semibold text-slate-800">Threat Scenarios</h2>
        <span className="ml-auto text-xs text-slate-400">Select to simulate</span>
      </div>

      {/* Scenario buttons */}
      <div className="flex flex-col gap-2">
        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
          const s = SCENARIOS[id];
          const isActive = id === activeScenario;
          const color = THREAT_COLORS[s.threat_level];

          return (
            <button
              key={id}
              onClick={() => onScenarioChange(id)}
              disabled={isSimulating}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 group
                ${isActive
                  ? `border-2 shadow-sm ${THREAT_ACTIVE[s.threat_level]}`
                  : `border-slate-200 bg-white ${THREAT_BG[s.threat_level]}`
                }
                ${isSimulating ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: isActive ? color + "20" : "#f1f5f9",
                    color: isActive ? color : "#64748b",
                  }}
                >
                  {SCENARIO_ICONS[id]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800 leading-tight">
                      {s.label}
                    </span>
                    {isActive && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                        style={{ backgroundColor: color + "20", color }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                    {s.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-bold tracking-wider" style={{ color }}>
                      {s.threat_level}
                    </span>
                    <span className="text-xs text-slate-400">
                      · Risk {(s.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${
                    isActive
                      ? "rotate-90 text-slate-600"
                      : "text-slate-300 group-hover:text-slate-500"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Tip */}
      <p className="text-xs text-slate-400 text-center pt-1">
        Switch to the <strong>Intelligence</strong> tab for Gemini AI analysis
      </p>
    </div>
  );
}
