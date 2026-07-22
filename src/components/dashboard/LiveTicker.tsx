"use client";

import { useEffect, useState } from "react";
import { Shield, Activity, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ThreatLevel, THREAT_COLORS } from "@/lib/config";

interface LiveTickerProps {
  threatLevel: ThreatLevel;
  scenarioLabel: string;
  riskScore: number;
  isSimulating: boolean;
  activeBPD: number;
  supplyDeficitPct: number;
  sprDaysRemaining: number;
  visiblePanels: string[];
  onTogglePanel: (id: string) => void;
  allPanels: Array<{ id: string; label: string }>;
  signalToRecommendationMs?: number | null;
}

// Mock live market data with slight random drift
function useMockPrice(base: number, volatility: number) {
  const [price, setPrice] = useState(base);
  const [trend, setTrend] = useState<"up" | "down" | "flat">("flat");
  useEffect(() => {
    const interval = setInterval(() => {
      const delta = (Math.random() - 0.5) * volatility;
      setPrice((p) => Math.max(base * 0.85, Math.min(base * 1.15, p + delta)));
      setTrend(delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat");
    }, 4000);
    return () => clearInterval(interval);
  }, [base, volatility]);
  return { price, trend };
}

const THREAT_CONFIG: Record<ThreatLevel, { bg: string; border: string; text: string; dot: string; glow: string }> = {
  LOW: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", glow: "" },
  MEDIUM: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", glow: "animate-pulse-amber" },
  HIGH: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", dot: "bg-orange-500", glow: "animate-pulse-amber" },
  CRITICAL: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500", glow: "animate-pulse-red" },
};

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-rose-500" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

export function LiveTicker({
  threatLevel,
  scenarioLabel,
  riskScore,
  isSimulating,
  activeBPD,
  supplyDeficitPct,
  sprDaysRemaining,
  visiblePanels,
  onTogglePanel,
  allPanels,
  signalToRecommendationMs = null,
}: LiveTickerProps) {
  const tc = THREAT_CONFIG[threatLevel];
  const brent = useMockPrice(82.4, 0.6);
  const wti = useMockPrice(78.9, 0.5);
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const color = THREAT_COLORS[threatLevel];

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[500] flex items-center gap-0"
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(226,232,240,0.9)",
        height: "48px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Map Zoom Controls */}
      <div
        className="flex items-center gap-1 px-3 h-full flex-shrink-0"
        style={{ borderRight: "1px solid #e2e8f0" }}
      >
        <button
          onClick={() => (window as any).kavachZoomIn?.()}
          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold flex items-center justify-center transition-all border border-slate-200"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => (window as any).kavachZoomOut?.()}
          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold flex items-center justify-center transition-all border border-slate-200"
          title="Zoom Out"
        >
          -
        </button>
      </div>

      {/* Threat badge */}
      <div
        className={`flex items-center gap-2 px-3 h-full flex-shrink-0 ${tc.bg} ${tc.glow}`}
        style={{ borderRight: "1px solid #e2e8f0" }}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${tc.dot} animate-blink`} />
        <span className={`text-xs font-bold tracking-widest ${tc.text}`}>{threatLevel}</span>
        <span className={`text-xs font-mono-data font-bold ${tc.text}`}>
          {(riskScore * 100).toFixed(0)}%
        </span>
      </div>

      {/* Scenario */}
      <div
        className="flex items-center gap-2 px-3 h-full flex-shrink-0 bg-white"
        style={{ borderRight: "1px solid #e2e8f0" }}
      >
        <span className="text-xs text-slate-400">Scenario:</span>
        <span className="text-xs font-semibold text-slate-700">{scenarioLabel}</span>
        {isSimulating && (
          <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        )}
        {signalToRecommendationMs !== null && signalToRecommendationMs !== undefined && (
          <span className="text-xs font-mono-data bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
            ⚡ {(signalToRecommendationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Live data ticker strip */}
      <div className="flex items-center gap-0 flex-1 overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Crude prices */}
        {[
          { label: "Brent", ...brent, unit: "$/bbl" },
          { label: "WTI", ...wti, unit: "$/bbl" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-1.5 px-3 h-full flex-shrink-0"
            style={{ borderRight: "1px solid #e2e8f0" }}
          >
            <span className="text-xs text-slate-400">{item.label}</span>
            <span className="text-xs font-bold font-mono-data text-slate-800">
              ${item.price.toFixed(2)}
            </span>
            <TrendIcon trend={item.trend} />
          </div>
        ))}

        {/* Supply metrics */}
        <div
          className="flex items-center gap-1.5 px-3 h-full flex-shrink-0"
          style={{ borderRight: "1px solid #e2e8f0" }}
        >
          <span className="text-xs text-slate-400">Active Supply</span>
          <span className="text-xs font-bold font-mono-data text-blue-700">
            {(activeBPD / 1_000_000).toFixed(2)}M BPD
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full flex-shrink-0"
          style={{ borderRight: "1px solid #e2e8f0" }}
        >
          <span className="text-xs text-slate-400">Supply Gap</span>
          <span
            className="text-xs font-bold font-mono-data"
            style={{ color: supplyDeficitPct > 0.1 ? "#e11d48" : "#22c55e" }}
          >
            {(supplyDeficitPct * 100).toFixed(1)}%
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full flex-shrink-0"
          style={{ borderRight: "1px solid #e2e8f0" }}
        >
          <span className="text-xs text-slate-400">SPR Cover</span>
          <span
            className="text-xs font-bold font-mono-data"
            style={{ color: sprDaysRemaining < 5 ? "#e11d48" : sprDaysRemaining < 8 ? "#f59e0b" : "#22c55e" }}
          >
            {sprDaysRemaining.toFixed(1)} days
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full flex-shrink-0"
          style={{ borderRight: "1px solid #e2e8f0" }}
        >
          <span className="text-xs text-slate-400">India Demand</span>
          <span className="text-xs font-bold font-mono-data text-slate-700">5.0M BPD</span>
        </div>

        <div className="flex-1" />
      </div>

      {/* Panel toggles */}
      <div
        className="flex items-center gap-1 px-3 h-full flex-shrink-0"
        style={{ borderLeft: "1px solid #e2e8f0" }}
      >
        {allPanels.map((p) => (
          <button
            key={p.id}
            onClick={() => onTogglePanel(p.id)}
            title={p.label}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              visiblePanels.includes(p.id)
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            {p.label.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Clock */}
      <div
        className="flex items-center gap-1.5 px-4 h-full flex-shrink-0"
        style={{ borderLeft: "1px solid #e2e8f0" }}
      >
        <Activity className="w-3 h-3 text-emerald-500" />
        <span className="text-xs font-mono-data text-slate-600" suppressHydrationWarning>
          {time} IST
        </span>
      </div>
    </div>
  );
}
