"use client";

import { useState, useCallback } from "react";
import { Zap, Brain, Shield, FileText, AlertTriangle, Radio, Clock } from "lucide-react";
import { SCENARIOS, ScenarioId, THREAT_COLORS } from "@/lib/config";
import type { RiskAssessment } from "@/lib/agents/riskParser";
import type { LiveAlert } from "@/hooks/useNewsFeed";


interface IntelligencePanelProps {
  activeScenario: ScenarioId;
  riskAssessment: RiskAssessment | null;
  onAnalyze: (text: string) => void;
  onOpenBrief: () => void;
  isAnalyzing: boolean;
  liveAlerts?: LiveAlert[];
  latestDetectionMs?: number | null;
  isPolling?: boolean;
}

const QUICK_SCENARIOS = [
  { label: "Hormuz Strike", text: "Iranian ballistic missile strikes near the Strait of Hormuz have caused VLCCs to divert. The corridor is effectively closed." },
  { label: "Houthi Attack", text: "Houthi forces launched drone attacks on oil tankers in the Red Sea near Bab-el-Mandeb, forcing major shipping companies to suspend transits." },
  { label: "Suez Grounding", text: "A container ship grounding has blocked the Suez Canal in both directions. Authorities estimate a 10-14 day clearance window." },
];

function formatLatency(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

export function IntelligencePanel({
  activeScenario,
  riskAssessment,
  onAnalyze,
  onOpenBrief,
  isAnalyzing,
  liveAlerts = [],
  latestDetectionMs = null,
  isPolling = false,
}: IntelligencePanelProps) {
  const [text, setText] = useState("");

  const handleAnalyze = useCallback(() => {
    onAnalyze(text);
  }, [text, onAnalyze]);

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* ── Live Feed Section ──────────────────────────────── */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Radio className="w-3.5 h-3.5 text-emerald-500" />
          <p className="text-xs font-semibold text-slate-700">Live Feed</p>
          {isPolling && (
            <div className="ml-auto w-3 h-3 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          )}
          {latestDetectionMs !== null && !isPolling && (
            <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              lag: {formatLatency(latestDetectionMs)}
            </span>
          )}
        </div>

        {liveAlerts.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {liveAlerts.slice(0, 3).map((alert) => {
              const color = THREAT_COLORS[alert.assessment.threat_level];
              return (
                <div
                  key={alert.id}
                  className="rounded-lg border p-2 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ borderColor: color + "40", background: color + "08" }}
                  onClick={() => onAnalyze(`${alert.title}. ${alert.assessment.event_summary}`)}
                  title="Click to run full analysis on this signal"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs font-bold truncate flex-1" style={{ color }}>
                      {alert.assessment.threat_level}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {formatLatency(alert.detectionLatencyMs)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 line-clamp-2 leading-tight">{alert.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{alert.source}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 flex items-center gap-2 text-slate-400">
            <Radio className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs">Polling GDELT for live signals…</span>
          </div>
        )}
      </div>

      {/* ── Manual Analysis Section ────────────────────────── */}
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
        rows={4}
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
