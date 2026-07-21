// ============================================================
// KAVACH — Fleet Telemetry API Route
// GET /api/fleet/telemetry?scenario=BASELINE
// Returns approximate sea route GeoJSON coordinates for
// rendering tanker lanes on the Leaflet map.
// Uses precomputed waypoints (searoute-js style coords).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { SCENARIOS, ScenarioId, ROUTE_COLORS } from "@/lib/config";
import networkData from "@/data/network.json";
import strategicPortsData from "@/data/strategic_ports.json";

export const runtime = "nodejs";

// ── Pre-defined sea lane waypoints ───────────────────────────
// These approximate real maritime routing through chokepoints.
// Coordinates are [lng, lat] for GeoJSON convention.

const SEA_ROUTES: Record<
  string,
  {
    id: string;
    label: string;
    waypoints: [number, number][]; // [lng, lat]
    type: "PRIMARY" | "REROUTED" | "BLOCKED";
    capacity_bpd: number;
  }
> = {
  // Primary: Ras Tanura → Hormuz → Jamnagar
  rt_hormuz_jam: {
    id: "rt_hormuz_jam",
    label: "Ras Tanura → Hormuz → Jamnagar",
    waypoints: [
      [50.158, 26.642], // Ras Tanura
      [56.25, 26.566],  // Strait of Hormuz
      [60.5, 23.5],     // Arabian Sea
      [65.0, 22.0],
      [70.05, 22.47],   // Jamnagar
    ],
    type: "PRIMARY",
    capacity_bpd: 1400000,
  },
  // Primary: Ras Tanura → Hormuz → Mumbai
  rt_hormuz_mumbai: {
    id: "rt_hormuz_mumbai",
    label: "Ras Tanura → Hormuz → Mumbai",
    waypoints: [
      [50.158, 26.642],
      [56.25, 26.566],
      [62.0, 22.0],
      [68.0, 20.0],
      [72.883, 18.95],
    ],
    type: "PRIMARY",
    capacity_bpd: 900000,
  },
  // Primary: Das Island → Hormuz → Mangalore
  das_hormuz_mangalore: {
    id: "das_hormuz_mangalore",
    label: "Das Island → Hormuz → Mangalore",
    waypoints: [
      [52.875, 25.143],
      [56.25, 26.566],
      [62.0, 20.0],
      [68.0, 15.0],
      [74.795, 12.926],
    ],
    type: "PRIMARY",
    capacity_bpd: 650000,
  },
  // Alternate: Ras Tanura → Cape of Good Hope → Jamnagar
  rt_cape_jamnagar: {
    id: "rt_cape_jamnagar",
    label: "Cape Bypass: Ras Tanura → Cape → Jamnagar",
    waypoints: [
      [50.158, 26.642],
      [52.0, 22.0],
      [50.0, 12.0],    // Gulf of Aden bypass
      [45.0, 2.0],     // East Africa coast
      [40.0, -10.0],
      [32.0, -25.0],
      [18.472, -34.358], // Cape of Good Hope
      [25.0, -30.0],
      [45.0, -20.0],
      [60.0, -10.0],
      [65.0, 5.0],
      [68.0, 15.0],
      [70.05, 22.47],
    ],
    type: "REROUTED",
    capacity_bpd: 1000000,
  },
  // Alternate: Das Island → Cape → Mumbai
  das_cape_mumbai: {
    id: "das_cape_mumbai",
    label: "Cape Bypass: Das Island → Cape → Mumbai",
    waypoints: [
      [52.875, 25.143],
      [50.0, 15.0],
      [44.0, 5.0],
      [40.0, -8.0],
      [30.0, -22.0],
      [18.472, -34.358],
      [22.0, -30.0],
      [40.0, -18.0],
      [58.0, -8.0],
      [65.0, 8.0],
      [72.883, 18.95],
    ],
    type: "REROUTED",
    capacity_bpd: 800000,
  },
  // Alternate: Novorossiysk → Suez → Jamnagar
  novo_suez_jamnagar: {
    id: "novo_suez_jamnagar",
    label: "Novorossiysk → Suez → Jamnagar",
    waypoints: [
      [37.767, 44.717],  // Novorossiysk
      [28.0, 38.0],      // Turkey straits area
      [30.0, 32.0],      // Med
      [32.327, 30.585],  // Suez Canal
      [35.0, 25.0],      // Red Sea
      [43.333, 12.583],  // Bab-el-Mandeb
      [50.0, 12.0],
      [60.0, 18.0],
      [65.0, 20.0],
      [70.05, 22.47],
    ],
    type: "PRIMARY",
    capacity_bpd: 600000,
  },
  // New international routes for recently added ports
  houston_cape_jamnagar: {
    id: "houston_cape_jamnagar",
    label: "Houston → Cape → Jamnagar",
    waypoints: [
      [-95.15, 29.73], // Houston
      [-80.0, 24.0],   // Gulf of Mexico exit
      [-60.0, 10.0],
      [-30.0, -10.0],  // Mid Atlantic
      [0.0, -30.0],
      [18.472, -34.358], // Cape
      [45.0, -20.0],
      [65.0, 5.0],
      [70.05, 22.47]   // Jamnagar
    ],
    type: "PRIMARY",
    capacity_bpd: 500000,
  },
  bonny_cape_mumbai: {
    id: "bonny_cape_mumbai",
    label: "Bonny Terminal → Cape → Mumbai",
    waypoints: [
      [7.15, 4.44],    // Bonny
      [0.0, -10.0],
      [10.0, -30.0],
      [18.472, -34.358], // Cape
      [40.0, -18.0],
      [60.0, -5.0],
      [72.883, 18.95]  // Mumbai
    ],
    type: "PRIMARY",
    capacity_bpd: 400000,
  },
  singapore_malacca_chennai: {
    id: "singapore_malacca_chennai",
    label: "Singapore → Malacca → Chennai",
    waypoints: [
      [103.68, 1.26],  // Singapore
      [98.0, 5.0],     // Malacca Strait
      [80.3, 13.4]     // Chennai
    ],
    type: "PRIMARY",
    capacity_bpd: 300000,
  },
  kozmino_pacific_visakh: {
    id: "kozmino_pacific_visakh",
    label: "Kozmino → Pacific → Visakhapatnam",
    waypoints: [
      [133.07, 42.74], // Kozmino
      [125.0, 30.0],   // East China Sea
      [115.0, 15.0],   // South China Sea
      [105.0, 5.0],
      [98.0, 5.0],     // Malacca
      [83.28, 17.7]    // Visakhapatnam
    ],
    type: "PRIMARY",
    capacity_bpd: 250000,
  }
};

// ── Vessel simulation (mock telemetry) ────────────────────────

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

function interpolatePoint(
  waypoints: [number, number][],
  t: number
): [number, number] {
  if (waypoints.length === 0) return [0, 0];
  if (waypoints.length === 1) return waypoints[0];

  const segCount = waypoints.length - 1;
  const segIdx = Math.floor(t * segCount);
  const clampedIdx = Math.min(segIdx, segCount - 1);
  const segT = t * segCount - clampedIdx;

  const [lng1, lat1] = waypoints[clampedIdx];
  const [lng2, lat2] = waypoints[clampedIdx + 1];

  return [lng1 + (lng2 - lng1) * segT, lat1 + (lat2 - lat1) * segT];
}

function generateMockVessels(
  scenarioId: string,
  blockedNodes: string[]
): VesselPosition[] {
  const now = Date.now();
  const vessels: VesselPosition[] = [];

  // Read real vessels data
  let realVessels: any = {};
  try {
    const rvPath = path.join(process.cwd(), "src/data/real_vessels.json");
    realVessels = JSON.parse(fs.readFileSync(rvPath, "utf-8"));
  } catch (e) {
    console.error("Could not load real_vessels.json");
  }

  const baseVessels: any[] = [];
  const vesselNames = Object.keys(realVessels);
  
  if (vesselNames.length > 0) {
    // Only assign vessels to routes that are visible in the current scenario
    const activeRoutes = Object.keys(SEA_ROUTES).filter(
      (k) => blockedNodes.length > 0 || SEA_ROUTES[k].type === "PRIMARY"
    );
    
    // We want around 36 vessels on the map, so we'll duplicate the real ones with slightly different offsets
    for (let i = 0; i < 36; i++) {
      const vName = vesselNames[i % vesselNames.length];
      const realData = realVessels[vName];
      const route_id = activeRoutes[i % activeRoutes.length];
      
      baseVessels.push({
        id: `V${i.toString().padStart(3, '0')}`,
        name: i >= vesselNames.length ? `${vName} II` : vName,
        type: realData.class || "Crude Carrier",
        cargo: realData.class?.includes("LNG") || realData.class?.includes("LPG") ? "Gas" : "Crude Oil",
        route_id: route_id,
        t_offset: (i * 0.08) % 1, // Stagger them along the routes
      });
    }
  }

  const isHormuzBlocked = blockedNodes.includes("strait_of_hormuz");
  const isBabBlocked = blockedNodes.includes("bab_el_mandeb");

  for (const v of baseVessels) {
    const route = SEA_ROUTES[v.route_id];
    if (!route) continue;

    // Determine status based on blockages
    let status: VesselPosition["status"] = "UNDERWAY";
    const routeUsesHormuz = ["rt_hormuz_jam", "rt_hormuz_mumbai", "das_hormuz_mangalore"].includes(v.route_id);
    const routeUsesBab = ["novo_suez_jamnagar"].includes(v.route_id);

    if ((isHormuzBlocked && routeUsesHormuz) || (isBabBlocked && routeUsesBab)) {
      status = "REROUTING";
    }

    // Add slow time drift
    const t = (v.t_offset + (now % 3_600_000) / 3_600_000 * 0.05) % 1;
    const [lng, lat] = interpolatePoint(route.waypoints, t);

    // Calculate heading (approximate)
    const t2 = Math.min(1, t + 0.02);
    const [lng2, lat2] = interpolatePoint(route.waypoints, t2);
    const heading = (Math.atan2(lng2 - lng, lat2 - lat) * 180) / Math.PI;

    vessels.push({
      id: v.id,
      name: v.name,
      type: v.type,
      lat,
      lng,
      heading: Math.round(heading),
      speed_knots: status === "REROUTING" ? 8 : 14,
      cargo_type: v.cargo,
      destination:
        v.route_id.includes("jam") ? "Jamnagar" :
        v.route_id.includes("mumbai") ? "Mumbai" : "Mangalore",
      status,
      route_id: v.route_id,
    });
  }
  return vessels;
}

const CACHE_FILE = path.join(process.cwd(), "src/data/vessel_cache.json");
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache duration

async function getLiveVesselsCached(blockedNodes: string[]): Promise<any[]> {
  const apiKey = process.env.VESSELAPI_API_KEY;
  if (!apiKey || apiKey === "your_vesselapi_key_here") return [];

  try {
    // 1. Check local cache file
    if (fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE);
      const isFresh = Date.now() - stats.mtimeMs < CACHE_DURATION_MS;
      if (isFresh) {
        const cachedContent = fs.readFileSync(CACHE_FILE, "utf-8");
        return JSON.parse(cachedContent);
      }
    }

    // 2. Fetch fresh data from VesselAPI (API quota call)
    console.log("KAVACH: Fetching fresh data from VesselAPI...");
    const res = await fetch(
      `https://api.vesselapi.com/v1/port/INBOM/inbound`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        },
        next: { revalidate: 1800 }
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "no-body");
      console.error(`KAVACH: VesselAPI failed with status ${res.status}: ${errText}`);
      throw new Error(`VesselAPI server returned non-200 status: ${res.status}`);
    }
    const json = await res.json();
    const rawETAs = json.vesselETAs || [];

    const isHormuzBlocked = blockedNodes.includes("strait_of_hormuz");
    const now = Date.now();

    // Map these real vessels to our active routes
    const mapped = rawETAs.map((v: any, index: number) => {
      const mmsi = v.vessel?.mmsi || Math.floor(Math.random() * 100000000);
      const name = v.vessel?.name || `Live Tanker ${mmsi}`;
      
      // Alternate routes to distribute the live vessels
      const possibleRoutes = [
        "rt_hormuz_jam",
        "rt_cape_jamnagar",
        "novo_suez_jamnagar"
      ];
      const routeId = possibleRoutes[index % possibleRoutes.length];
      const route = SEA_ROUTES[routeId];

      let status: "UNDERWAY" | "AT_ANCHOR" | "REROUTING" = "UNDERWAY";
      if (isHormuzBlocked && ["rt_hormuz_jam"].includes(routeId)) {
        status = "REROUTING";
      }

      // Interpolate position along the chosen route
      const t_offset = 0.1 + (index * 0.15) % 0.8;
      const t = (t_offset + (now % 3_600_000) / 3_600_000 * 0.05) % 1;
      const [lng, lat] = interpolatePoint(route ? route.waypoints : [[50.158, 26.642], [70.05, 22.47]], t);

      // Estimate heading
      const t2 = Math.min(1, t + 0.02);
      const [lng2, lat2] = interpolatePoint(route ? route.waypoints : [[50.158, 26.642], [70.05, 22.47]], t2);
      const heading = Math.round((Math.atan2(lng2 - lng, lat2 - lat) * 180) / Math.PI);

      // Formulate human ETA
      let etaStr = "N/A";
      if (v.timestamp) {
        try {
          const d = new Date(v.timestamp);
          etaStr = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        } catch (e) {}
      }

      return {
        id: `live-${mmsi}`,
        name,
        type: index % 2 === 0 ? "VLCC Crude Carrier" : "Q-Max LNG Carrier",
        cargo_type: index % 2 === 0 ? "Sour Crude Oil" : "Liquefied Natural Gas (LNG)",
        lat,
        lng,
        heading,
        speed_knots: status === "REROUTING" ? 8 : 14,
        destination: "Jamnagar, India",
        status,
        route_id: routeId,
        eta: etaStr,
        isLive: true
      };
    });

    // Save cache locally
    fs.writeFileSync(CACHE_FILE, JSON.stringify(mapped, null, 2), "utf-8");
    return mapped;
  } catch (err) {
    console.error("KAVACH: Error fetching from VesselAPI, serving fallback cache:", err);
    if (fs.existsSync(CACHE_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      } catch (e) {
        return [];
      }
    }
    return [];
  }
}

const WPI_PORT_MAPPING: Record<string, string> = {
  ras_tanura: "RAS  TANNURAH",
  das_island: "JAZIRAT DAS",
  novorossiysk: "NOVOROSSIYSK",
  jamnagar_port: "SIKKA",
  mumbai_port: "MUMBAI (BOMBAY)",
  new_mangalore_port: "NEW MANGALORE"
};

let globalPortsCache: any[] | null = null;

function getWPIPortDetails(nodeId: string): any | null {
  const wpiName = WPI_PORT_MAPPING[nodeId];
  if (!wpiName) return null;

  try {
    if (!globalPortsCache) {
      const filePath = path.join(process.cwd(), "src/data/global_ports.json");
      if (fs.existsSync(filePath)) {
        let raw = fs.readFileSync(filePath, "utf-8");
        if (raw.charCodeAt(0) === 0xFEFF) {
          raw = raw.slice(1);
        }
        const data = JSON.parse(raw);
        globalPortsCache = data.ports || [];
      }
    }

    if (globalPortsCache) {
      return globalPortsCache.find(
        (p: any) => p.wpi_port_name && p.wpi_port_name.toUpperCase() === wpiName.toUpperCase()
      ) || null;
    }
  } catch (err) {
    console.error("KAVACH: Error reading global_ports.json", err);
  }
  return null;
}

function getStrategicPorts(): any[] {
  // Return the curated strategic ports for India's crude oil supply chain
  // These are real-world export terminals and Indian import/refinery ports
  const filePath = path.join(process.cwd(), "src/data/strategic_ports.json");
  let data = { ports: [] };
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    data = JSON.parse(raw);
  } catch(e) {}
  
  return (data.ports as any[]).map((p: any) => ({
    id: `strategic-${p.id}`,
    name: p.name,
    country: p.country,
    size: p.type === "export" ? "Major" : "Minor",
    portType: p.type,
    lat: p.lat,
    lng: p.lng,
    role: p.role,
    crude_types: p.crude_types,
    india_share_pct: p.india_share_pct,
    depth_m: 20.0,
  }));
}

// ── API Handler ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scenarioId = (searchParams.get("scenario") ?? "BASELINE") as ScenarioId;

  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS.BASELINE;
  const blockedNodes: string[] = [...(scenario.blocked_nodes ?? [])];

  // Build route features for GeoJSON from explicitly defined SEA_ROUTES
  const routeFeatures = Object.values(SEA_ROUTES).map((route) => {
    let status: "PRIMARY" | "REROUTED" | "BLOCKED" = route.type;

    // Check if route passes through blocked nodes
    const isHormuzBlocked = blockedNodes.includes("strait_of_hormuz");
    const isBabBlocked = blockedNodes.includes("bab_el_mandeb");
    const isSuezBlocked = blockedNodes.includes("suez_canal");

    const routeUsesHormuz = route.waypoints.some(
      ([lng]) => Math.abs(lng - 56.25) < 2
    );
    const routeUsesBab = route.waypoints.some(
      ([lng]) => Math.abs(lng - 43.333) < 2
    );
    const routeUsesSuez = route.waypoints.some(
      ([lng]) => Math.abs(lng - 32.327) < 2
    );

    if (
      (isHormuzBlocked && routeUsesHormuz) ||
      (isBabBlocked && routeUsesBab) ||
      (isSuezBlocked && routeUsesSuez)
    ) {
      status = "BLOCKED";
    }

    const color =
      status === "BLOCKED"
        ? ROUTE_COLORS.BLOCKED
        : status === "REROUTED"
          ? ROUTE_COLORS.REROUTED
          : ROUTE_COLORS.PRIMARY;

    return {
      type: "Feature" as const,
      properties: {
        id: route.id,
        label: route.label,
        status,
        color,
        capacity_bpd: route.capacity_bpd,
        visible: status !== "REROUTED" || blockedNodes.length > 0,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: route.waypoints,
      },
    };
  });

  // Load strategically meaningful ports for India's oil supply chain
  const regionalPorts = getStrategicPorts();


  // Node features
  const networkFilePath = path.join(process.cwd(), "src/data/network.json");
  let dynamicNetworkData = { nodes: [] };
  try {
    const rawNet = fs.readFileSync(networkFilePath, "utf-8");
    dynamicNetworkData = JSON.parse(rawNet);
  } catch (e) {}

  const nodeFeatures = (dynamicNetworkData.nodes as any[]).map(
    (node) => {
      const wpiDetails = getWPIPortDetails(node.id);
      return {
        type: "Feature" as const,
        properties: {
          id: node.id,
          label: node.label,
          type: node.type,
          isBlocked: blockedNodes.includes(node.id),
          country: node.country,
          capacity_bpd: node.capacity_bpd,
          strategic_risk: (node as { strategic_risk?: string }).strategic_risk,
          description: node.description,
          // Inject real NGA WPI particulars
          wpi_details: wpiDetails ? {
            port_id: wpiDetails.wpi_port_id,
            port_name: wpiDetails.wpi_port_name,
            port_size: wpiDetails.port_size,
            max_vessel_size: wpiDetails.max_vessel_size,
            channel_depth_max_m: wpiDetails.channel_depth_max_m,
            anchorage_depth_max_m: wpiDetails.anchorage_depth_max_m,
            cargo_pier_depth_max_m: wpiDetails.cargo_pier_depth_max_m,
            oil_terminal_depth_max_m: wpiDetails.oil_terminal_depth_max_m,
            mean_tidal_range_m: wpiDetails.mean_tidal_range_m,
            restriction_swell: wpiDetails.entrance_restriction_heavy_swell || false,
            restriction_tide: wpiDetails.entrance_restriction_tide || false,
          } : null
        },
        geometry: {
          type: "Point" as const,
          // network.json stores [lat, lng] — convert to GeoJSON [lng, lat]
          coordinates: [node.coordinates[1], node.coordinates[0]],
        },
      };
    }
  );

  // Vessel telemetry
  const simulatedVessels = generateMockVessels(scenarioId, blockedNodes);
  const liveAisVessels = await getLiveVesselsCached(blockedNodes);
  const vessels = [...simulatedVessels, ...liveAisVessels];


  // Merge regional ports into main nodes so they render exactly the same
  const regionalNodeFeatures = regionalPorts.map(rPort => {
    const isPrimaryNode = dynamicNetworkData.nodes.some((n: any) => 
      n.label.toUpperCase().includes(rPort.name.toUpperCase()) || 
      (rPort.name.toUpperCase().includes("SIKKA") && n.id === "jamnagar_port") ||
      (rPort.name.toUpperCase().includes("MUMBAI") && n.id === "mumbai_port") ||
      (rPort.name.toUpperCase().includes("MANGALORE") && n.id === "new_mangalore_port")
    );
    
    if (isPrimaryNode) return null;

    return {
      type: "Feature" as const,
      properties: {
        id: rPort.id,
        label: rPort.name.split(' (')[0], // Clean label
        type: rPort.portType === "export" ? "supplier" : "entry_port",
        isBlocked: blockedNodes.includes(rPort.id),
        country: rPort.country,
        capacity_bpd: null, 
        strategic_risk: null,
        description: rPort.role,
        wpi_details: null
      },
      geometry: {
        type: "Point" as const,
        coordinates: [rPort.lng, rPort.lat],
      }
    };
  }).filter(Boolean);

  nodeFeatures.push(...regionalNodeFeatures);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    scenario: scenarioId,
    routes: {
      type: "FeatureCollection",
      features: routeFeatures,
    },
    nodes: {
      type: "FeatureCollection",
      features: nodeFeatures,
    },
    vessels,
    regionalPorts: [], // We merged them into nodes
  });
}
