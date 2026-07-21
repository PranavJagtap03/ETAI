"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer } from "@/components/dashboard/MapContainer";
import { LiveTicker } from "@/components/dashboard/LiveTicker";
import { DraggableWidget } from "@/components/dashboard/DraggableWidget";
import { ScenarioPanel } from "@/components/dashboard/ScenarioPanel";
import { RiskPanel } from "@/components/dashboard/RiskPanel";
import { SPRPanel } from "@/components/dashboard/SPRPanel";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel";
import { ImportMixPanel } from "@/components/dashboard/ImportMixPanel";
import { ExecutiveBriefModal } from "@/components/dashboard/ExecutiveBriefModal";
import {
  AlertTriangle, Shield, Database, Ship, Brain, Globe2, Satellite,
} from "lucide-react";
import { ScenarioId, ThreatLevel, SCENARIOS, THREAT_COLORS } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────

interface SimulationData {
  scenario: { id: string; label: string; description: string; threat_level: ThreatLevel; risk_score: number };
  rerouting: {
    blockedBPD: number; activeBPD: number; unservedBPD: number; supplyDeficitPct: number;
    avgRerouteCostIncrease: number; avgRerouteDelayDays: number;
    routeCount: number; reroutedCount: number; blockedCount: number;
  };
  spr: {
    initialBarrels: number; initialDays: number;
    exhaustionDayUnmitigated: number | null; exhaustionDayRerouted: number | null; daysSaved: number;
    trajectoryUnmitigated: SPRDay[]; trajectoryRerouted: SPRDay[];
  };
  macro: {
    supplyDeficitBPD: number; supplyDeficitPct: number; fuelPriceSpikePercentage: number;
    refineryRunRateDropPct: number; dailyGDPLossUSD: number; fifteenDayGDPLossUSD: number;
    fuelPriceSpikeLabel: string; gdpLossLabel: string; refineryHitLabel: string;
    supplyDeficitLabel: string; macroAlertLevel: "LOW" | "MODERATE" | "SEVERE" | "CATASTROPHIC";
    crudePriceBreakevenUSD: number; additionalImportCostPerDay: number; dailyImpactSeries: unknown[];
  };
  network: { nodes: unknown[]; edges: unknown[] };
}

interface SPRDay {
  day: number; date: string; reserveBarrels: number; reserveDays: number;
  pctRemaining: number; drawdownBarrels: number; alertStatus: string;
}

interface TelemetryData {
  routes: { type: string; features: RouteFeature[] };
  nodes: { type: string; features: NodeFeature[] };
  vessels: VesselPosition[];
  regionalPorts?: any[];
}

interface RouteFeature {
  type: "Feature";
  properties: { id: string; label: string; status: "PRIMARY" | "REROUTED" | "BLOCKED"; color: string; capacity_bpd: number; visible: boolean };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

interface NodeFeature {
  type: "Feature";
  properties: { id: string; label: string; type: string; isBlocked: boolean; country: string; capacity_bpd?: number; strategic_risk?: string; description: string };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface VesselPosition {
  id: string; name: string; type: string;
  lat: number; lng: number; heading: number; speed_knots: number;
  cargo_type: string; destination: string; status: "UNDERWAY" | "AT_ANCHOR" | "REROUTING"; route_id: string;
}

interface RiskAssessment {
  impacted_chokepoint: string; threat_level: ThreatLevel; risk_score: number;
  event_summary: string; recommended_action: string; affected_suppliers: string[];
  estimated_disruption_days: number; india_impact_severity: string;
}

// ── Baseline ───────────────────────────────────────────────

const makeBaseline = (): SimulationData => ({
  scenario: { id: "BASELINE", label: "Baseline (No Disruption)", description: "All supply lanes operational.", threat_level: "LOW", risk_score: 0.05 },
  rerouting: { blockedBPD: 0, activeBPD: 4400000, unservedBPD: 0, supplyDeficitPct: 0, avgRerouteCostIncrease: 0, avgRerouteDelayDays: 0, routeCount: 9, reroutedCount: 0, blockedCount: 0 },
  spr: {
    initialBarrels: 47500000, initialDays: 9.5, exhaustionDayUnmitigated: null, exhaustionDayRerouted: null, daysSaved: 0,
    trajectoryUnmitigated: Array.from({ length: 16 }, (_, i) => ({ day: i, date: "", reserveBarrels: 47500000, reserveDays: 9.5, pctRemaining: 100, drawdownBarrels: 0, alertStatus: "NORMAL" })),
    trajectoryRerouted: Array.from({ length: 16 }, (_, i) => ({ day: i, date: "", reserveBarrels: 47500000, reserveDays: 9.5, pctRemaining: 100, drawdownBarrels: 0, alertStatus: "NORMAL" })),
  },
  macro: { supplyDeficitBPD: 0, supplyDeficitPct: 0, fuelPriceSpikePercentage: 0, refineryRunRateDropPct: 0, dailyGDPLossUSD: 0, fifteenDayGDPLossUSD: 0, fuelPriceSpikeLabel: "+0.0%", gdpLossLabel: "$0", refineryHitLabel: "-0.0%", supplyDeficitLabel: "0.0%", macroAlertLevel: "LOW", crudePriceBreakevenUSD: 80, additionalImportCostPerDay: 0, dailyImpactSeries: [] },
  network: { nodes: [], edges: [] },
});

// ── Panel registry ─────────────────────────────────────────

const ALL_PANELS = [
  { id: "scenarios", label: "Scenarios" },
  { id: "risk", label: "Risk" },
  { id: "spr", label: "SPR" },
  { id: "fleet", label: "Fleet" },
  { id: "intel", label: "Intel" },
  { id: "imports", label: "Imports" },
] as const;

type PanelId = (typeof ALL_PANELS)[number]["id"];

// ── Main Page ──────────────────────────────────────────────

export default function KavachCommandCenter() {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("BASELINE");
  const [simData, setSimData] = useState<SimulationData>(makeBaseline());
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [executiveBrief, setExecutiveBrief] = useState("");
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [visiblePanels, setVisiblePanels] = useState<PanelId[]>([]);

  const telemetryInterval = useRef<NodeJS.Timeout | null>(null);

  // ── Simulation ────────────────────────────────────────────

  const runSimulation = useCallback(async (scenarioId: ScenarioId) => {
    setIsSimulating(true);
    setIsMapLoading(true);
    try {
      const [simRes, telRes] = await Promise.all([
        fetch("/api/engine/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId }) }),
        fetch(`/api/fleet/telemetry?scenario=${scenarioId}&t=${Date.now()}`),
      ]);
      const [simJson, telJson] = await Promise.all([simRes.json(), telRes.json()]);
      setSimData(simJson);
      setTelemetry(telJson);
    } catch (err) { console.error(err); }
    finally { setIsSimulating(false); setIsMapLoading(false); }
  }, []);

  useEffect(() => { runSimulation("BASELINE"); }, [runSimulation]);

  useEffect(() => {
    telemetryInterval.current = setInterval(() => {
      fetch(`/api/fleet/telemetry?scenario=${activeScenario}&t=${Date.now()}`).then(r => r.json()).then(setTelemetry).catch(() => {});
    }, 30000);
    return () => { if (telemetryInterval.current) clearInterval(telemetryInterval.current); };
  }, [activeScenario]);

  const handleScenarioChange = useCallback((id: ScenarioId) => {
    setActiveScenario(id);
    setExecutiveBrief("");
    setRiskAssessment(null);
    runSimulation(id);
  }, [runSimulation]);

  // ── AI Analysis ───────────────────────────────────────────

  const handleAnalyze = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ingestion/news", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news: text }),
      });
      const json = await res.json();
      if (json.success) setRiskAssessment(json.assessment);
    } catch (err) { console.error(err); }
    finally { setIsAnalyzing(false); }
  }, []);

  const handleGenerateBrief = useCallback(async () => {
    setIsGeneratingBrief(true);
    try {
      const res = await fetch("/api/ingestion/news", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: activeScenario, news: SCENARIOS[activeScenario].description }),
      });
      const json = await res.json();
      const assessment = json.assessment;
      if (assessment) setRiskAssessment(assessment);
      const sprDay = simData.spr.trajectoryRerouted.at(-1);
      setExecutiveBrief(buildBrief(activeScenario, assessment, simData, sprDay?.reserveDays ?? 9.5));
    } catch (err) { console.error(err); }
    finally { setIsGeneratingBrief(false); }
  }, [activeScenario, simData]);

  // ── Panel visibility ──────────────────────────────────────

  const togglePanel = useCallback((id: string) => {
    setVisiblePanels(prev =>
      prev.includes(id as PanelId)
        ? prev.filter(p => p !== id)
        : [...prev, id as PanelId]
    );
  }, []);

  const currentThreat: ThreatLevel = simData.scenario.threat_level ?? "LOW";
  const sprLastDay = simData.spr.trajectoryRerouted.at(-1);
  const blockedNodes: string[] = [...(SCENARIOS[activeScenario].blocked_nodes ?? [])];

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-900">

      {/* ── Full-screen Map ──────────────────────────────── */}
      <div className="absolute inset-0" style={{ top: 0 }}>
        <MapContainer
          routes={telemetry?.routes?.features ?? []}
          nodes={telemetry?.nodes?.features ?? []}
          vessels={telemetry?.vessels ?? []}
          regionalPorts={telemetry?.regionalPorts ?? []}
          isLoading={isMapLoading}
        />
      </div>

      {/* ── Top Bar ──────────────────────────────────────── */}
      <LiveTicker
        threatLevel={currentThreat}
        scenarioLabel={simData.scenario.label}
        riskScore={simData.scenario.risk_score}
        isSimulating={isSimulating}
        activeBPD={simData.rerouting.activeBPD}
        supplyDeficitPct={simData.rerouting.supplyDeficitPct}
        sprDaysRemaining={sprLastDay?.reserveDays ?? 9.5}
        visiblePanels={visiblePanels}
        onTogglePanel={togglePanel}
        allPanels={ALL_PANELS as unknown as Array<{ id: string; label: string }>}
      />

      {/* ── Floating Widgets ─────────────────────────────── */}
      <DraggableWidget
        id="scenarios"
        title="Threat Scenarios"
        icon={<AlertTriangle className="w-3.5 h-3.5" />}
        defaultPosition={{ x: 16, y: 64 }}
        defaultWidth={280}
        accentColor={THREAT_COLORS[currentThreat]}
        onClose={() => togglePanel("scenarios")}
        visible={visiblePanels.includes("scenarios")}
      >
        <ScenarioPanel
          activeScenario={activeScenario}
          onScenarioChange={handleScenarioChange}
          isSimulating={isSimulating}
        />
      </DraggableWidget>

      <DraggableWidget
        id="risk"
        title="Risk Intelligence"
        icon={<Shield className="w-3.5 h-3.5" />}
        defaultPosition={{ x: 16, y: 420 }}
        defaultWidth={290}
        accentColor="#1e3a8a"
        onClose={() => togglePanel("risk")}
        visible={visiblePanels.includes("risk")}
      >
        <RiskPanel
          threatLevel={currentThreat}
          riskScore={simData.scenario.risk_score}
          supplyDeficitPct={simData.rerouting.supplyDeficitPct}
          activeBPD={simData.rerouting.activeBPD}
          blockedBPD={simData.rerouting.blockedBPD}
          reroutedCount={simData.rerouting.reroutedCount}
          blockedCount={simData.rerouting.blockedCount}
          avgRerouteCost={simData.rerouting.avgRerouteCostIncrease}
          avgRerouteDelay={simData.rerouting.avgRerouteDelayDays}
          fuelPriceSpikeLabel={simData.macro.fuelPriceSpikeLabel}
          refineryHitLabel={simData.macro.refineryHitLabel}
          gdpLossLabel={simData.macro.gdpLossLabel}
          macroAlertLevel={simData.macro.macroAlertLevel}
        />
      </DraggableWidget>

      <DraggableWidget
        id="spr"
        title="SPR Analysis"
        icon={<Database className="w-3.5 h-3.5" />}
        defaultPosition={{ x: 320, y: 64 }}
        defaultWidth={300}
        accentColor="#1e3a8a"
        onClose={() => togglePanel("spr")}
        visible={visiblePanels.includes("spr")}
      >
        <SPRPanel
          trajectoryUnmitigated={simData.spr.trajectoryUnmitigated}
          trajectoryRerouted={simData.spr.trajectoryRerouted}
          exhaustionDayUnmitigated={simData.spr.exhaustionDayUnmitigated}
          exhaustionDayRerouted={simData.spr.exhaustionDayRerouted}
          daysSaved={simData.spr.daysSaved}
          initialSPRBarrels={simData.spr.initialBarrels}
        />
      </DraggableWidget>

      <DraggableWidget
        id="fleet"
        title="Fleet Tracker"
        icon={<Ship className="w-3.5 h-3.5" />}
        defaultPosition={{ x: 630, y: 64 }}
        defaultWidth={288}
        accentColor="#0284c7"
        onClose={() => togglePanel("fleet")}
        visible={visiblePanels.includes("fleet")}
      >
        <FleetPanel
          vessels={telemetry?.vessels ?? []}
          blockedNodes={blockedNodes}
        />
      </DraggableWidget>

      <DraggableWidget
        id="intel"
        title="Intelligence"
        icon={<Brain className="w-3.5 h-3.5" />}
        defaultPosition={{ x: 940, y: 64 }}
        defaultWidth={300}
        accentColor="#7c3aed"
        onClose={() => togglePanel("intel")}
        visible={visiblePanels.includes("intel")}
      >
        <IntelligencePanel
          activeScenario={activeScenario}
          riskAssessment={riskAssessment}
          onAnalyze={handleAnalyze}
          onOpenBrief={() => { setIsBriefOpen(true); if (!executiveBrief) handleGenerateBrief(); }}
          isAnalyzing={isAnalyzing}
        />
      </DraggableWidget>

      <DraggableWidget
        id="imports"
        title="India Import Mix"
        icon={<Globe2 className="w-3.5 h-3.5" />}
        defaultPosition={{ x: 1260, y: 64 }}
        defaultWidth={300}
        accentColor="#059669"
        onClose={() => togglePanel("imports")}
        visible={visiblePanels.includes("imports")}
      >
        <ImportMixPanel supplyDeficitPct={simData.rerouting.supplyDeficitPct} />
      </DraggableWidget>

      {/* Executive Brief Modal */}
      <ExecutiveBriefModal
        isOpen={isBriefOpen}
        onClose={() => setIsBriefOpen(false)}
        scenarioLabel={simData.scenario.label}
        riskAssessment={riskAssessment}
        executiveBrief={executiveBrief}
        isGenerating={isGeneratingBrief}
        onGenerateBrief={handleGenerateBrief}
      />
    </div>
  );
}

// ── Brief builder ────────────────────────────────────────────

function buildBrief(scenarioId: ScenarioId, assessment: RiskAssessment | null, simData: SimulationData, sprDays: number): string {
  const a = assessment;
  const sc = SCENARIOS[scenarioId];
  return `## SITUATION ASSESSMENT

**${sc.label.toUpperCase()} — ${a?.threat_level ?? "UNKNOWN"} THREAT**

${a?.event_summary ?? sc.description} India's 88% crude import dependency means any chokepoint disruption creates immediate supply chain stress.

## SUPPLY CHAIN STATUS

Active import supply: ${(simData.rerouting.activeBPD / 1_000_000).toFixed(2)}M BPD (${(simData.rerouting.supplyDeficitPct * 100).toFixed(1)}% deficit). ${simData.rerouting.reroutedCount} alternate paths active, ${simData.rerouting.blockedCount} primary lanes blocked. Cape of Good Hope bypass adds +$${simData.rerouting.avgRerouteCostIncrease.toFixed(2)}/bbl and +${simData.rerouting.avgRerouteDelayDays.toFixed(1)} transit days.

## ECONOMIC RISK WINDOW

SPR cover: ~${sprDays.toFixed(1)} days remaining. Fuel prices projected +${simData.macro.fuelPriceSpikeLabel}. Daily GDP friction: ${simData.macro.gdpLossLabel}. 15-day cumulative: ${simData.macro.macroAlertLevel} severity.

## RECOMMENDED ACTIONS

• **Immediate:** Activate SPR drawdown from Vizag + Padur sites to bridge ${(simData.rerouting.unservedBPD / 1000).toFixed(0)}K BPD gap
• **72-hour:** Emergency spot procurement — Nigeria, US Gulf Coast, Latin America
• **Strategic:** Cape of Good Hope maritime clearances + Indian Navy escort protocols

## STRATEGIC OUTLOOK

${a?.recommended_action ?? "Monitor situation and maintain contingency readiness."} Decisive rerouting action preserves ${simData.spr.daysSaved > 0 ? `+${simData.spr.daysSaved} days` : "continuity"} of supply security.`;
}
