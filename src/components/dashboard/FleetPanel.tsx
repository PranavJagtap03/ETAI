"use client";

import { Ship, AlertTriangle, Anchor } from "lucide-react";

interface VesselPosition {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  heading: number;
  speed_knots: number;
  cargo_type: string;
  destination: string;
  status: "UNDERWAY" | "AT_ANCHOR" | "REROUTING";
  route_id: string;
}

interface FleetPanelProps {
  vessels: VesselPosition[];
  blockedNodes: string[];
}

const STATUS_CONFIG = {
  UNDERWAY: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  AT_ANCHOR: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
  REROUTING: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
};

const TYPE_DWT: Record<string, string> = {
  VLCC: "200–320K DWT",
  Suezmax: "120–200K DWT",
  Aframax: "80–120K DWT",
  "Q-Max LNG": "125K DWT",
  "LPG Tanker": "55K DWT",
  "VLCC Crude Carrier": "310K DWT",
  "Q-Max LNG Carrier": "128K DWT",
  "LPG Tanker (VLGC)": "54K DWT",
  "Suezmax Crude Carrier": "158K DWT",
  "Aframax Crude Tanker": "112K DWT",
  "Aframax Product Tanker": "115K DWT"
};

export function FleetPanel({ vessels, blockedNodes }: FleetPanelProps) {
  const isHormuzBlocked = blockedNodes.includes("strait_of_hormuz");
  const allVessels = vessels;

  const counts = {
    UNDERWAY: allVessels.filter((v) => v.status === "UNDERWAY").length,
    REROUTING: allVessels.filter((v) => v.status === "REROUTING").length,
    AT_ANCHOR: allVessels.filter((v) => v.status === "AT_ANCHOR").length,
  };

  // Estimated cargo per vessel type (MB/vessel or energy equivalent)
  const totalCargoMB = allVessels.reduce((sum, v) => {
    const typeUpper = v.type.toUpperCase();
    const size = typeUpper.includes("VLCC") ? 2.0
      : (typeUpper.includes("SUEZMAX") || typeUpper.includes("LNG")) ? 1.2
      : 0.8;
    return sum + size;
  }, 0);

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "Underway", count: counts.UNDERWAY, color: "#3b82f6" },
          { label: "Rerouting", count: counts.REROUTING, color: "#f59e0b" },
          { label: "At Anchor", count: counts.AT_ANCHOR, color: "#94a3b8" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
            <div className="text-lg font-bold font-mono-data" style={{ color: s.color }}>{s.count}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Total cargo estimate */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Ship className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs text-blue-700 font-medium">Total Cargo in Transit</span>
        </div>
        <span className="text-xs font-bold font-mono-data text-blue-800">
          ~{totalCargoMB.toFixed(1)}M bbl
        </span>
      </div>

      {/* Hormuz alert */}
      {isHormuzBlocked && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 font-medium leading-relaxed">
            Hormuz blocked — {counts.REROUTING} vessels diverting to Cape route (+12–15 days)
          </p>
        </div>
      )}

      {/* Vessel list */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tracked Vessels</span>
        {allVessels.map((v) => {
          const sc = STATUS_CONFIG[v.status];
          return (
            <div
              key={v.id}
              className={`rounded-lg border p-2.5 ${sc.bg} ${sc.border}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Anchor className={`w-3 h-3 flex-shrink-0 ${sc.text}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{v.name}</div>
                    <div className="text-xs text-slate-500">{v.type} · {v.cargo_type}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-bold ${sc.bg} ${sc.border} ${sc.text}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {v.status}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                <span>→ {v.destination}</span>
                <span>{v.speed_knots} kts</span>
                <span className="font-mono-data">{TYPE_DWT[v.type] || "120K DWT"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
