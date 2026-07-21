// ============================================================
// KAVACH — Supply Route Optimizer (Rerouter)
// Uses Dijkstra with crude grade penalties, capacity checks,
// and distance-weighted cost to find optimal alternate routes
// when chokepoints are blocked.
// ============================================================

import {
  DigitalTwin,
  NetworkNode,
  NetworkEdge,
  CrudeType,
} from "@/lib/engine/digitalTwin";
import {
  GRADE_MISMATCH_SURCHARGE_PER_BARREL,
  GRADE_MISMATCH_DELAY_DAYS,
  INDIA_DAILY_DEMAND_BPD,
  IMPORT_DEPENDENCY_PCT,
} from "@/lib/config";

// ── Types ────────────────────────────────────────────────────

export interface RouteOption {
  id: string;
  label: string;
  supplier: NetworkNode;
  port: NetworkNode;
  path: string[];
  pathLabels: string[];
  totalCostPerBarrel: number;
  totalTransitDays: number;
  capacityBPD: number;
  crudeType: CrudeType;
  gradeMismatch: boolean;
  gradeSurchargePBL: number;
  gradeDelayDays: number;
  isPrimary: boolean;
  isBlocked: boolean;
  status: "OPERATIONAL" | "REROUTED" | "BLOCKED";
}

export interface RerouteResult {
  scenario: string;
  blockedNodes: string[];
  blockedBPD: number;        // supply cut off by blockage
  activeBPD: number;         // supply flowing through rerouted paths
  unservedBPD: number;       // demand still unmet
  supplyDeficitPct: number;  // fraction of total demand unmet
  routes: RouteOption[];
  reroutedRoutes: RouteOption[];
  blockedRoutes: RouteOption[];
  avgRerouteCostIncrease: number; // USD/barrel delta vs baseline
  avgRerouteDelayDays: number;    // additional transit days
}

// ── Rerouter Class ───────────────────────────────────────────

export class Rerouter {
  private twin: DigitalTwin;

  constructor(twin: DigitalTwin) {
    this.twin = twin;
  }

  /**
   * Resolve the bottleneck capacity along a path (minimum edge capacity)
   */
  private pathCapacity(path: string[]): number {
    let minCap = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const fromId = path[i];
      const toId = path[i + 1];
      const graph = this.twin.getGraph();

      graph.forEachEdge(fromId, toId, (_key, attrs) => {
        const edge = attrs as NetworkEdge;
        minCap = Math.min(minCap, edge.capacity_bpd);
      });
    }
    return minCap === Infinity ? 0 : minCap;
  }

  /**
   * Determine crude type flowing along a path (based on supplier)
   */
  private pathCrudeType(supplier: NetworkNode): CrudeType {
    return supplier.crude_type ?? "Mixed";
  }

  /**
   * Compute grade mismatch penalty for a refinery
   */
  private computeGradePenalty(
    supplierCrude: CrudeType,
    refineryConfigure: CrudeType
  ): { mismatch: boolean; surcharge: number; delayDays: number } {
    // Mismatch occurs when refinery expects Sour but gets Sweet, or vice versa
    if (refineryConfigure === "Mixed" || supplierCrude === "Mixed") {
      return { mismatch: false, surcharge: 0, delayDays: 0 };
    }
    if (supplierCrude !== refineryConfigure) {
      return {
        mismatch: true,
        surcharge: GRADE_MISMATCH_SURCHARGE_PER_BARREL,
        delayDays: GRADE_MISMATCH_DELAY_DAYS,
      };
    }
    return { mismatch: false, surcharge: 0, delayDays: 0 };
  }

  /**
   * Find all available routes from a supplier to a port, considering blockages.
   * Returns primary and alternate paths with full cost breakdown.
   */
  private findRouteOptions(
    supplier: NetworkNode,
    port: NetworkNode
  ): RouteOption[] {
    const options: RouteOption[] = [];

    // Try Dijkstra path (with blocked nodes excluded)
    const result = this.twin.dijkstra(supplier.id, port.id);

    if (result && result.path.length > 1) {
      const crude = this.pathCrudeType(supplier);
      const capacity = this.pathCapacity(result.path);

      // Check if any node in the path is a blocked chokepoint
      const blocked = result.path.some((n) => this.twin.isBlocked(n));

      // Get path labels
      const pathLabels = result.path.map(
        (id) => this.twin.getNode(id)?.label ?? id
      );

      // Check if this uses primary edges
      const isPrimary = result.path.includes("strait_of_hormuz");

      // Find connecting refinery to compute grade mismatch
      // (the port feeds a specific refinery, we approximate via port->refinery link)
      const refinery = this._getLinkedRefinery(port.id);
      const configuredCrude: CrudeType =
        (refinery?.configured_crude as CrudeType) ?? "Mixed";

      const { mismatch, surcharge, delayDays } = this.computeGradePenalty(
        crude,
        configuredCrude
      );

      const totalCost = result.totalCost + surcharge;

      options.push({
        id: `${supplier.id}_${port.id}`,
        label: `${supplier.label} → ${port.label}`,
        supplier,
        port,
        path: result.path,
        pathLabels,
        totalCostPerBarrel: totalCost,
        totalTransitDays: result.totalDays + delayDays,
        capacityBPD: capacity,
        crudeType: crude,
        gradeMismatch: mismatch,
        gradeSurchargePBL: surcharge,
        gradeDelayDays: delayDays,
        isPrimary,
        isBlocked: blocked,
        status: blocked ? "BLOCKED" : isPrimary ? "OPERATIONAL" : "REROUTED",
      });
    } else {
      // No path found (completely blocked)
      options.push({
        id: `${supplier.id}_${port.id}`,
        label: `${supplier.label} → ${port.label}`,
        supplier,
        port,
        path: [],
        pathLabels: [],
        totalCostPerBarrel: 0,
        totalTransitDays: 0,
        capacityBPD: 0,
        crudeType: this.pathCrudeType(supplier),
        gradeMismatch: false,
        gradeSurchargePBL: 0,
        gradeDelayDays: 0,
        isPrimary: false,
        isBlocked: true,
        status: "BLOCKED",
      });
    }

    return options;
  }

  /**
   * Look up the primary refinery linked to a port
   */
  private _getLinkedRefinery(portId: string): NetworkNode | null {
    const graph = this.twin.getGraph();
    let refinery: NetworkNode | null = null;

    if (!graph.hasNode(portId)) return null;

    graph.forEachOutEdge(portId, (_key, _attrs, _source, target) => {
      const node = this.twin.getNode(target);
      if (node?.type === "refinery") refinery = node;
    });

    return refinery;
  }

  /**
   * Full scenario rerouting computation.
   * Blocks nodes, recomputes all routes, measures supply shortfall.
   *
   * Formula: Path Cost = Σ(Base Edge Cost) + Distance Penalty + Grade Mismatch Cost
   */
  computeRerouting(
    scenarioId: string,
    blockedNodeIds: string[]
  ): RerouteResult {
    // Apply blockages
    this.twin.blockNodes(blockedNodeIds);

    const suppliers = this.twin.getNodesByType("supplier");
    const ports = this.twin.getNodesByType("entry_port");

    // Compute baseline (no blockage) routes first
    this.twin.clearBlocks();
    const baselineRoutes: RouteOption[] = [];
    for (const supplier of suppliers) {
      for (const port of ports) {
        const opts = this.findRouteOptions(supplier, port);
        baselineRoutes.push(...opts);
      }
    }
    const baselineAvgCost =
      baselineRoutes.reduce((sum, r) => sum + r.totalCostPerBarrel, 0) /
      baselineRoutes.length;
    const baselineAvgDays =
      baselineRoutes.reduce((sum, r) => sum + r.totalTransitDays, 0) /
      baselineRoutes.length;

    // Re-apply blockages and compute rerouted routes
    this.twin.blockNodes(blockedNodeIds);
    const allRoutes: RouteOption[] = [];
    for (const supplier of suppliers) {
      for (const port of ports) {
        const opts = this.findRouteOptions(supplier, port);
        allRoutes.push(...opts);
      }
    }

    const operationalRoutes = allRoutes.filter((r) => !r.isBlocked);
    const blockedRoutes = allRoutes.filter((r) => r.isBlocked);
    const reroutedRoutes = allRoutes.filter(
      (r) => !r.isBlocked && !r.isPrimary
    );

    // Calculate active supply volume
    const activeBPD = operationalRoutes.reduce(
      (sum, r) => sum + Math.min(r.capacityBPD, INDIA_DAILY_DEMAND_BPD / 3),
      0
    );

    // Total demand for import
    const totalImportDemand = INDIA_DAILY_DEMAND_BPD * IMPORT_DEPENDENCY_PCT;

    // Blocked supply (capacity through blocked paths)
    const blockedBPD = blockedRoutes.reduce(
      (sum, r) =>
        sum +
        (baselineRoutes.find(
          (b) => b.supplier.id === r.supplier.id && b.port.id === r.port.id
        )?.capacityBPD ?? 0),
      0
    );

    const unservedBPD = Math.max(0, totalImportDemand - activeBPD);
    const supplyDeficitPct = unservedBPD / INDIA_DAILY_DEMAND_BPD;

    // Cost delta
    const reroutedAvgCost =
      reroutedRoutes.length > 0
        ? reroutedRoutes.reduce((sum, r) => sum + r.totalCostPerBarrel, 0) /
          reroutedRoutes.length
        : baselineAvgCost;

    const avgRerouteCostIncrease = reroutedAvgCost - baselineAvgCost;

    const reroutedAvgDays =
      reroutedRoutes.length > 0
        ? reroutedRoutes.reduce((sum, r) => sum + r.totalTransitDays, 0) /
          reroutedRoutes.length
        : baselineAvgDays;

    const avgRerouteDelayDays = reroutedAvgDays - baselineAvgDays;

    // Clear for next computation
    this.twin.clearBlocks();

    return {
      scenario: scenarioId,
      blockedNodes: blockedNodeIds,
      blockedBPD: Math.round(blockedBPD),
      activeBPD: Math.round(activeBPD),
      unservedBPD: Math.round(unservedBPD),
      supplyDeficitPct: Math.min(1, supplyDeficitPct),
      routes: allRoutes,
      reroutedRoutes,
      blockedRoutes,
      avgRerouteCostIncrease: Math.round(avgRerouteCostIncrease * 100) / 100,
      avgRerouteDelayDays: Math.round(avgRerouteDelayDays * 10) / 10,
    };
  }
}
