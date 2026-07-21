"use client";

import { ThreatLevel, THREAT_COLORS } from "@/lib/config";
import { TrendingDown, BarChart3, Route, AlertCircle, Fuel, Factory, DollarSign } from "lucide-react";

interface RiskPanelProps {
  threatLevel: ThreatLevel;
  riskScore: number;
  supplyDeficitPct: number;
  activeBPD: number;
  blockedBPD: number;
  reroutedCount: number;
  blockedCount: number;
  avgRerouteCost: number;
  avgRerouteDelay: number;
  fuelPriceSpikeLabel: string;
  refineryHitLabel: string;
  gdpLossLabel: string;
  macroAlertLevel: string;
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value * 100)}%`, background: color }}
      />
    </div>
  );
}

export function RiskPanel({
  threatLevel,
  riskScore,
  supplyDeficitPct,
  activeBPD,
  blockedBPD,
  reroutedCount,
  blockedCount,
  avgRerouteCost,
  avgRerouteDelay,
  fuelPriceSpikeLabel,
  refineryHitLabel,
  gdpLossLabel,
  macroAlertLevel,
}: RiskPanelProps) {
  const color = THREAT_COLORS[threatLevel];

  const ALERT_COLORS: Record<string, string> = {
    LOW: "#22c55e", MODERATE: "#f59e0b", SEVERE: "#f97316", CATASTROPHIC: "#e11d48"
  };
  const alertColor = ALERT_COLORS[macroAlertLevel] ?? "#22c55e";

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Composite risk score */}
      <div className="rounded-xl p-3 border" style={{ background: color + "0a", borderColor: color + "30" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500 font-medium">Composite Risk</span>
          <span className="text-2xl font-extrabold font-mono-data" style={{ color }}>
            {(riskScore * 100).toFixed(0)}<span className="text-sm">%</span>
          </span>
        </div>
        <MiniBar value={riskScore} color={color} />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">0%</span>
          <span className="text-xs font-bold" style={{ color }}>{threatLevel}</span>
          <span className="text-xs text-slate-400">100%</span>
        </div>
      </div>

      {/* Supply snapshot */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="w-3 h-3 text-rose-500" />
            <span className="text-xs text-slate-500">Deficit</span>
          </div>
          <div className="text-lg font-bold font-mono-data text-slate-900">
            {(supplyDeficitPct * 100).toFixed(1)}<span className="text-xs font-normal text-slate-500">%</span>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
          <div className="flex items-center gap-1 mb-1">
            <BarChart3 className="w-3 h-3 text-blue-500" />
            <span className="text-xs text-slate-500">Active</span>
          </div>
          <div className="text-lg font-bold font-mono-data text-slate-900">
            {(activeBPD / 1_000_000).toFixed(2)}<span className="text-xs font-normal text-slate-500">M</span>
          </div>
        </div>
      </div>

      {/* Route status */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Route className="w-3 h-3 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">Route Status</span>
        </div>
        {[
          { dot: "bg-blue-700", label: "Operational", count: Math.max(0, 9 - blockedCount) },
          { dot: "bg-emerald-500", label: "Rerouted", count: reroutedCount },
          { dot: "bg-rose-500", label: "Blocked", count: blockedCount },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${row.dot}`} />
              <span className="text-xs text-slate-600">{row.label}</span>
            </div>
            <span className="text-xs font-bold font-mono-data text-slate-700">{row.count}</span>
          </div>
        ))}
      </div>

      {/* Macro shock mini */}
      <div className="border-t border-slate-100 pt-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertCircle className="w-3 h-3" style={{ color: alertColor }} />
          <span className="text-xs font-semibold text-slate-700">Macro Shock</span>
          <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: alertColor + "20", color: alertColor }}>
            {macroAlertLevel}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: <Fuel className="w-3 h-3" />, label: "Fuel", value: fuelPriceSpikeLabel, color: "#e11d48" },
            { icon: <Factory className="w-3 h-3" />, label: "Refinery", value: refineryHitLabel, color: "#d97706" },
            { icon: <DollarSign className="w-3 h-3" />, label: "GDP/day", value: gdpLossLabel, color: "#1e3a8a" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
              <div style={{ color: m.color }} className="flex justify-center mb-0.5">{m.icon}</div>
              <div className="text-xs font-bold font-mono-data" style={{ color: m.color }}>{m.value}</div>
              <div className="text-xs text-slate-400">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rerouting cost */}
      {(avgRerouteCost > 0 || avgRerouteDelay > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-center">
            <div className="text-sm font-bold font-mono-data text-amber-700">+${avgRerouteCost.toFixed(2)}</div>
            <div className="text-xs text-amber-600">per barrel</div>
          </div>
          <div className="rounded-lg bg-orange-50 border border-orange-100 p-2 text-center">
            <div className="text-sm font-bold font-mono-data text-orange-700">+{avgRerouteDelay.toFixed(1)}d</div>
            <div className="text-xs text-orange-600">transit delay</div>
          </div>
        </div>
      )}
    </div>
  );
}
