"use client";

// ============================================================
// KAVACH — Alternatives Panel
// Shows top-3 ranked rerouting alternatives with plain-language
// rationale strings so a policy-maker can act without digging
// through raw route arrays.
// ============================================================

interface Alternative {
  id: string;
  label: string;
  totalCostPerBarrel: number;
  totalTransitDays: number;
  capacityBPD: number;
  crudeType: string;
  gradeMismatch: boolean;
  gradeSurchargePBL: number;
  gradeDelayDays: number;
  rationale: string;
  status: string;
}

interface AlternativesPanelProps {
  alternatives: Alternative[];
}

const GRADE_BADGE: Record<string, { label: string; color: string }> = {
  Sour:  { label: "Sour",  color: "#d97706" },
  Sweet: { label: "Sweet", color: "#059669" },
  Mixed: { label: "Mixed", color: "#6366f1" },
};

export function AlternativesPanel({ alternatives }: AlternativesPanelProps) {
  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="border-t border-slate-100 pt-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-semibold text-slate-700">Top Alternatives</span>
        <span className="ml-auto text-xs text-slate-400 font-mono-data">by landed cost</span>
      </div>

      <div className="flex flex-col gap-2">
        {alternatives.map((alt, idx) => {
          const gradeInfo = GRADE_BADGE[alt.crudeType] ?? GRADE_BADGE["Mixed"];
          return (
            <div
              key={alt.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs"
            >
              {/* Rank + label */}
              <div className="flex items-start gap-2 mb-1.5">
                <span
                  className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ fontSize: 9, background: idx === 0 ? "#059669" : idx === 1 ? "#0284c7" : "#6366f1" }}
                >
                  {idx + 1}
                </span>
                <span className="font-semibold text-slate-800 leading-tight">{alt.label}</span>
              </div>

              {/* Metrics row */}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-mono-data font-bold text-slate-700">
                  ${alt.totalCostPerBarrel.toFixed(2)}<span className="font-normal text-slate-400">/bbl</span>
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono-data text-slate-600">{alt.totalTransitDays}d</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono-data text-slate-600">{(alt.capacityBPD / 1_000_000).toFixed(2)}M BPD</span>
                <span
                  className="px-1 rounded text-white font-bold"
                  style={{ fontSize: 9, background: gradeInfo.color }}
                >
                  {gradeInfo.label}
                </span>
                {alt.gradeMismatch && (
                  <span className="text-amber-600 font-medium">⚠ mismatch</span>
                )}
              </div>

              {/* Rationale */}
              <p className="text-slate-500 leading-relaxed" style={{ fontSize: 10 }}>
                {alt.rationale}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
