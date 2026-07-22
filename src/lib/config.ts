// ============================================================
// KAVACH Platform — Global Constants & Configuration
// ============================================================

// ── India Crude Oil Demand ──────────────────────────────────
export const INDIA_DAILY_DEMAND_BPD = 5_000_000; // barrels per day

// ── Strategic Petroleum Reserve ────────────────────────────
export const SPR_BASELINE_DAYS = 9.5; // days of buffer
export const SPR_BASELINE_BARRELS =
  SPR_BASELINE_DAYS * INDIA_DAILY_DEMAND_BPD; // = 47,500,000 barrels

// SPR storage sites (Vizag, Mangalore, Padur)
export const SPR_SITES = [
  { name: "Vizag SPR", capacity_mb: 9.75 },
  { name: "Mangalore SPR", capacity_mb: 11.25 },
  { name: "Padur SPR", capacity_mb: 26.5 },
];

// ── Import Dependency ───────────────────────────────────────
export const IMPORT_DEPENDENCY_PCT = 0.88; // 88% crude is imported
export const HORMUZ_DEPENDENCY_PCT = 0.425; // ~42.5% transits Hormuz

// ── Refinery Grade Mismatch Penalty ────────────────────────
// Applied when refinery configured for Sour receives Sweet crude
export const GRADE_MISMATCH_SURCHARGE_PER_BARREL = 2.5; // USD/barrel
export const GRADE_MISMATCH_DELAY_DAYS = 2; // additional processing days

// ── Macro-Economic Friction Factor ─────────────────────────
// GDP economic friction per barrel of supply deficit
export const GDP_FRICTION_USD_PER_BARREL = 42; // USD/barrel

// ── Macro Impact Multipliers ────────────────────────────────
export const FUEL_PRICE_SPIKE_MULTIPLIER = 1.45;
export const REFINERY_RUNRATE_MULTIPLIER = 0.85;

// ── Simulation Window ───────────────────────────────────────
export const SIM_DAYS = 15; // default simulation horizon

// ── Risk Level Thresholds ───────────────────────────────────
export const RISK_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.55,
  HIGH: 0.75,
  CRITICAL: 0.9,
};

// ── Scenario Definitions ────────────────────────────────────
export const SCENARIOS = {
  HORMUZ_SHUTDOWN: {
    id: "HORMUZ_SHUTDOWN",
    label: "Hormuz Shutdown",
    description:
      "Complete blockade of the Strait of Hormuz — zero throughput. Triggers mandatory Cape rerouting.",
    blocked_nodes: ["strait_of_hormuz"],
    risk_score: 0.95,
    threat_level: "CRITICAL" as const,
  },
  RED_SEA_ESCALATION: {
    id: "RED_SEA_ESCALATION",
    label: "Red Sea Escalation",
    description:
      "Houthi escalation forces closure of Bab-el-Mandeb & Red Sea lanes. Suez throughput drops to 30%.",
    blocked_nodes: ["bab_el_mandeb"],
    risk_score: 0.72,
    threat_level: "HIGH" as const,
  },
  SUEZ_DISRUPTION: {
    id: "SUEZ_DISRUPTION",
    label: "Suez Canal Disruption",
    description:
      "Suez blockage (similar to Ever Given) — extended closure forces Cape-of-Good-Hope alternate routing.",
    blocked_nodes: ["suez_canal"],
    risk_score: 0.55,
    threat_level: "MEDIUM" as const,
  },
  DUAL_CHOKEPOINT: {
    id: "DUAL_CHOKEPOINT",
    label: "Dual Chokepoint Crisis",
    description:
      "Simultaneous blockage of Hormuz & Bab-el-Mandeb. Maximum stress scenario — SPR drawdown begins immediately.",
    blocked_nodes: ["strait_of_hormuz", "bab_el_mandeb"],
    risk_score: 0.98,
    threat_level: "CRITICAL" as const,
  },
  BASELINE: {
    id: "BASELINE",
    label: "Baseline (No Disruption)",
    description:
      "All supply lanes operational at full capacity. Normal operations.",
    blocked_nodes: [],
    risk_score: 0.05,
    threat_level: "LOW" as const,
  },
} as const;

export type ScenarioId = keyof typeof SCENARIOS;
export type ThreatLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ── Threat Level Colors ─────────────────────────────────────
export const THREAT_COLORS: Record<ThreatLevel, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#e11d48",
};

// ── Map Route Colors ─────────────────────────────────────────
export const ROUTE_COLORS = {
  PRIMARY: "#1e3a8a", // Navy blue — standard operational
  REROUTED: "#10b981", // Emerald — rerouted/optimized
  BLOCKED: "#e11d48", // Crimson — threatened/blocked
};

// ── Gemini Configuration ─────────────────────────────────────
export const GEMINI_MODEL = "gemini-2.5-flash-lite";
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
