"use client";

import { SCENARIOS, ScenarioId, THREAT_COLORS } from "@/lib/config";
import { Anchor, Ship, Globe, Waves, Zap, ChevronRight } from "lucide-react";

const SCENARIO_ICONS: Record<ScenarioId, React.ReactNode> = {
  BASELINE: <Globe className="w-3.5 h-3.5" />,
  HORMUZ_SHUTDOWN: <Anchor className="w-3.5 h-3.5" />,
  RED_SEA_ESCALATION: <Waves className="w-3.5 h-3.5" />,
  SUEZ_DISRUPTION: <Ship className="w-3.5 h-3.5" />,
  DUAL_CHOKEPOINT: <Zap className="w-3.5 h-3.5" />,
};

interface ScenarioPanelProps {
  activeScenario: ScenarioId;
  onScenarioChange: (id: ScenarioId) => void;
  isSimulating: boolean;
}

export function ScenarioPanel({ activeScenario, onScenarioChange, isSimulating }: ScenarioPanelProps) {
  return (
    <div className="p-3 flex flex-col gap-1.5">
      {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
        const s = SCENARIOS[id];
        const isActive = id === activeScenario;
        const color = THREAT_COLORS[s.threat_level];
        return (
          <button
            key={id}
            onClick={() => onScenarioChange(id)}
            disabled={isSimulating}
            className={`w-full text-left p-2.5 rounded-xl border-2 transition-all duration-200 group
              ${isActive ? "border-current bg-opacity-5" : "border-slate-200 bg-white hover:border-slate-300"}
              ${isSimulating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            style={isActive ? { borderColor: color, background: color + "0d" } : {}}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: isActive ? color + "20" : "#f1f5f9", color: isActive ? color : "#64748b" }}
              >
                {SCENARIO_ICONS[id]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-800 leading-tight">{s.label}</span>
                  {isActive && (
                    <span className="text-xs px-1 py-0.5 rounded font-bold uppercase tracking-wider" style={{ background: color + "20", color }}>
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs font-bold" style={{ color }}>{s.threat_level}</span>
                  <span className="text-xs text-slate-400">· {(s.risk_score * 100).toFixed(0)}%</span>
                </div>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isActive ? "rotate-90 text-slate-500" : "text-slate-300"}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
