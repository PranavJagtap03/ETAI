"use client";

import { ThreatLevel, THREAT_COLORS } from "@/lib/config";
import {
  Shield,
  TrendingDown,
  BarChart3,
  Route,
  AlertCircle,
} from "lucide-react";

interface RiskOverviewProps {
  threatLevel: ThreatLevel;
  riskScore: number;
  supplyDeficitPct: number;
  blockedBPD: number;
  activeBPD: number;
  reroutedCount: number;
  blockedCount: number;
  avgRerouteDelay: number;
  avgRerouteCost: number;
}

function RiskBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${Math.min(100, value * 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export function RiskOverview({
  threatLevel,
  riskScore,
  supplyDeficitPct,
  blockedBPD,
  activeBPD,
  reroutedCount,
  blockedCount,
  avgRerouteDelay,
  avgRerouteCost,
}: RiskOverviewProps) {
  const color = THREAT_COLORS[threatLevel];

  const THREAT_BG: Record<ThreatLevel, string> = {
    LOW: "bg-emerald-50 border-emerald-200",
    MEDIUM: "bg-amber-50 border-amber-200",
    HIGH: "bg-orange-50 border-orange-200",
    CRITICAL: "bg-rose-50 border-rose-200",
  };

  return (
    <div className="kavach-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Risk Intelligence
          </h2>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg border"
          style={{
            backgroundColor: color + "15",
            color,
            borderColor: color + "40",
          }}
        >
          {threatLevel}
        </span>
      </div>

      {/* Composite Risk Score */}
      <div className={`rounded-xl p-4 border ${THREAT_BG[threatLevel]}`}>
        <div className="flex items-end justify-between mb-2">
          <span className="text-xs text-slate-500 font-medium">
            Composite Risk Score
          </span>
          <span
            className="text-3xl font-extrabold font-mono-data leading-none"
            style={{ color }}
          >
            {(riskScore * 100).toFixed(0)}
            <span className="text-lg">%</span>
          </span>
        </div>
        <RiskBar value={riskScore} color={color} />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">0</span>
          <span className="text-xs text-slate-400">50</span>
          <span className="text-xs text-slate-400">100</span>
        </div>
      </div>

      {/* Supply metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-xs text-slate-500">Supply Deficit</span>
          </div>
          <span className="text-xl font-bold font-mono-data text-slate-900">
            {(supplyDeficitPct * 100).toFixed(1)}
            <span className="text-sm font-normal text-slate-500">%</span>
          </span>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-slate-500">Active Supply</span>
          </div>
          <span className="text-xl font-bold font-mono-data text-slate-900">
            {(activeBPD / 1_000_000).toFixed(2)}
            <span className="text-sm font-normal text-slate-500">M BPD</span>
          </span>
        </div>
      </div>

      {/* Route status */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <Route className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-xs font-semibold text-slate-700">
            Route Status
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="route-dot bg-blue-700" />
              <span className="text-xs text-slate-600">Operational Routes</span>
            </div>
            <span className="text-xs font-bold font-mono-data text-slate-800">
              {reroutedCount > 0 ? reroutedCount : 9 - blockedCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="route-dot bg-emerald-500" />
              <span className="text-xs text-slate-600">Rerouted Paths</span>
            </div>
            <span className="text-xs font-bold font-mono-data text-slate-800">
              {reroutedCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="route-dot bg-rose-500" />
              <span className="text-xs text-slate-600">Blocked Routes</span>
            </div>
            <span className="text-xs font-bold font-mono-data text-rose-600">
              {blockedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Rerouting impact */}
      {(avgRerouteCost > 0 || avgRerouteDelay > 0) && (
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-slate-700">
              Rerouting Impact
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 rounded-lg bg-amber-50 border border-amber-100">
              <div className="text-lg font-bold font-mono-data text-amber-700">
                +${avgRerouteCost.toFixed(2)}
              </div>
              <div className="text-xs text-amber-600">per barrel</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-orange-50 border border-orange-100">
              <div className="text-lg font-bold font-mono-data text-orange-700">
                +{avgRerouteDelay.toFixed(1)}d
              </div>
              <div className="text-xs text-orange-600">transit delay</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
