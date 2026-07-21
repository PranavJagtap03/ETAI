// ============================================================
// KAVACH — Digital Twin Graph Engine
// Builds a directed graphology graph from network.json
// and provides query utilities for the simulation engine.
// ============================================================

import Graph from "graphology";
import networkData from "@/data/network.json";

// ── Types ────────────────────────────────────────────────────

export type CrudeType = "Sweet" | "Sour" | "Mixed";

export type NodeType =
  | "supplier"
  | "chokepoint"
  | "entry_port"
  | "refinery";

export interface NetworkNode {
  id: string;
  label: string;
  type: NodeType;
  country: string;
  coordinates: [number, number]; // [lat, lng]
  capacity_bpd?: number;
  crude_type?: CrudeType;
  configured_crude?: CrudeType;
  api_gravity?: number;
  sulfur_pct?: number;
  throughput_bpd?: number;
  strategic_risk?: string;
  nelson_complexity?: number;
  description: string;
}

export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  distance_nm: number;
  cost_per_barrel: number;
  capacity_bpd: number;
  type: CrudeType;
  transit_days: number;
  is_primary: boolean;
}

export interface GraphEdgeAttributes extends NetworkEdge {
  blocked: boolean;
  effective_cost: number; // includes penalties
}

// ── Digital Twin Class ───────────────────────────────────────

export class DigitalTwin {
  private graph: Graph;
  private nodes: Map<string, NetworkNode>;
  private edges: Map<string, NetworkEdge>;
  private blockedNodes: Set<string>;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false });
    this.nodes = new Map();
    this.edges = new Map();
    this.blockedNodes = new Set();

    this._initialize();
  }

  private _initialize(): void {
    // Load all nodes
    for (const node of networkData.nodes as NetworkNode[]) {
      this.nodes.set(node.id, node);
      this.graph.addNode(node.id, { ...node });
    }

    // Load all edges
    for (const edge of networkData.edges as NetworkEdge[]) {
      this.edges.set(edge.id, edge);
      this.graph.addDirectedEdge(edge.from, edge.to, {
        ...edge,
        blocked: false,
        effective_cost: edge.cost_per_barrel,
      } as GraphEdgeAttributes);
    }
  }

  // ── Blocking API ──────────────────────────────────────────

  /** Mark nodes as blocked (chokepoint closure) */
  blockNodes(nodeIds: string[]): void {
    this.blockedNodes = new Set(nodeIds);
  }

  /** Clear all blocks */
  clearBlocks(): void {
    this.blockedNodes.clear();
  }

  /** Check if a node is blocked */
  isBlocked(nodeId: string): boolean {
    return this.blockedNodes.has(nodeId);
  }

  // ── Graph Access ─────────────────────────────────────────

  getGraph(): Graph {
    return this.graph;
  }

  getNode(id: string): NetworkNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): NetworkNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): NetworkEdge[] {
    return Array.from(this.edges.values());
  }

  getBlockedNodes(): Set<string> {
    return new Set(this.blockedNodes);
  }

  getNodesByType(type: NodeType): NetworkNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.type === type);
  }

  // ── Path Utilities ────────────────────────────────────────

  /**
   * Get all outgoing edges from a node, optionally filtering blocked nodes
   */
  getOutEdges(
    nodeId: string,
    excludeBlocked = true
  ): Array<{ edge: NetworkEdge; target: string }> {
    if (!this.graph.hasNode(nodeId)) return [];

    const result: Array<{ edge: NetworkEdge; target: string }> = [];

    this.graph.forEachOutEdge(nodeId, (edgeKey, attrs, source, target) => {
      if (excludeBlocked && this.blockedNodes.has(target)) return;
      const edge = attrs as GraphEdgeAttributes;
      result.push({ edge, target });
    });

    return result;
  }

  /**
   * Compute adjacency list for Dijkstra (excluding blocked nodes)
   */
  buildAdjacencyList(
    excludeBlocked = true
  ): Map<string, Array<{ target: string; edge: NetworkEdge }>> {
    const adj = new Map<
      string,
      Array<{ target: string; edge: NetworkEdge }>
    >();

    this.graph.forEachNode((nodeId) => {
      if (excludeBlocked && this.blockedNodes.has(nodeId)) return;
      adj.set(nodeId, []);
    });

    this.graph.forEachEdge((edgeKey, attrs, source, target) => {
      if (excludeBlocked && this.blockedNodes.has(source)) return;
      if (excludeBlocked && this.blockedNodes.has(target)) return;

      const list = adj.get(source);
      if (list) {
        list.push({ target, edge: attrs as NetworkEdge });
      }
    });

    return adj;
  }

  /**
   * Get suppliers currently reachable to a given port (path exists through unblocked nodes)
   */
  getReachableSuppliers(portId: string): NetworkNode[] {
    const suppliers = this.getNodesByType("supplier");
    return suppliers.filter((s) => {
      const paths = this.dijkstra(s.id, portId);
      return paths !== null && paths.path.length > 0;
    });
  }

  /**
   * Dijkstra shortest path by cost (USD/barrel) between two nodes
   */
  dijkstra(
    sourceId: string,
    targetId: string
  ): { path: string[]; totalCost: number; totalDays: number } | null {
    const adj = this.buildAdjacencyList(true);
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const days = new Map<string, number>();
    const unvisited = new Set<string>();

    for (const nodeId of adj.keys()) {
      dist.set(nodeId, Infinity);
      prev.set(nodeId, null);
      days.set(nodeId, 0);
      unvisited.add(nodeId);
    }

    dist.set(sourceId, 0);

    while (unvisited.size > 0) {
      // Find min dist unvisited node
      let u: string | null = null;
      let minDist = Infinity;
      for (const nodeId of unvisited) {
        const d = dist.get(nodeId) ?? Infinity;
        if (d < minDist) {
          minDist = d;
          u = nodeId;
        }
      }

      if (u === null || u === targetId) break;
      unvisited.delete(u);

      const neighbors = adj.get(u) ?? [];
      for (const { target, edge } of neighbors) {
        if (!unvisited.has(target)) continue;
        const alt = (dist.get(u) ?? Infinity) + edge.cost_per_barrel;
        if (alt < (dist.get(target) ?? Infinity)) {
          dist.set(target, alt);
          prev.set(target, u);
          days.set(target, (days.get(u) ?? 0) + edge.transit_days);
        }
      }
    }

    // Reconstruct path
    if ((dist.get(targetId) ?? Infinity) === Infinity) return null;

    const path: string[] = [];
    let cur: string | null = targetId;
    while (cur !== null) {
      path.unshift(cur);
      cur = prev.get(cur) ?? null;
    }

    return {
      path,
      totalCost: dist.get(targetId) ?? Infinity,
      totalDays: days.get(targetId) ?? 0,
    };
  }

  /**
   * Get active supply routes: supplier → port pairs with their best paths
   */
  getActiveSupplyRoutes(): Array<{
    supplier: NetworkNode;
    port: NetworkNode;
    path: string[];
    cost: number;
    days: number;
    isBlocked: boolean;
  }> {
    const suppliers = this.getNodesByType("supplier");
    const ports = this.getNodesByType("entry_port");
    const routes: ReturnType<typeof this.getActiveSupplyRoutes> = [];

    for (const supplier of suppliers) {
      for (const port of ports) {
        // Check if path exists without blocked constraints first
        const rawPath = this.dijkstra(supplier.id, port.id);
        const isBlocked =
          rawPath === null ||
          rawPath.path.some((n) => this.blockedNodes.has(n));

        const bestPath = rawPath;
        routes.push({
          supplier,
          port,
          path: bestPath?.path ?? [],
          cost: bestPath?.totalCost ?? 0,
          days: bestPath?.totalDays ?? 0,
          isBlocked,
        });
      }
    }

    return routes;
  }
}

// ── Singleton factory ─────────────────────────────────────────

let _instance: DigitalTwin | null = null;

export function getDigitalTwin(): DigitalTwin {
  if (!_instance) {
    _instance = new DigitalTwin();
  }
  return _instance;
}

export function resetDigitalTwin(): void {
  _instance = null;
}
