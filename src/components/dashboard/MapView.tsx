"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import realVessels from "@/data/real_vessels.json";

// ── Types ──────────────────────────────────────────────────

interface RouteFeature {
  type: "Feature";
  properties: {
    id: string;
    label: string;
    status: "PRIMARY" | "REROUTED" | "BLOCKED";
    color: string;
    capacity_bpd: number;
    visible: boolean;
  };
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

interface NodeFeature {
  type: "Feature";
  properties: {
    id: string;
    label: string;
    type: string;
    isBlocked: boolean;
    country: string;
    capacity_bpd?: number;
    strategic_risk?: string;
    description: string;
    wpi_details?: {
      port_id: number;
      port_name: string;
      port_size: string;
      max_vessel_size: string;
      channel_depth_max_m: number | null;
      anchorage_depth_max_m: number | null;
      cargo_pier_depth_max_m: number | null;
      oil_terminal_depth_max_m: number | null;
      mean_tidal_range_m: number | null;
      restriction_swell: boolean;
      restriction_tide: boolean;
    } | null;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

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
  eta?: string;
  isLive?: boolean;
}

interface MapViewProps {
  routes: RouteFeature[];
  nodes: NodeFeature[];
  vessels: VesselPosition[];
  regionalPorts?: any[];
}

// ── Node styling ──────────────────────────────────────────

const NODE_STYLE: Record<
  string,
  { color: string; fillColor: string; radius: number; icon: string }
> = {
  supplier: {
    color: "#1e3a8a",
    fillColor: "#3b82f6",
    radius: 10,
    icon: "⛽",
  },
  chokepoint: {
    color: "#be123c",
    fillColor: "#f43f5e",
    radius: 12,
    icon: "🛡️", // Fix chokepoint icon as shield
  },
  entry_port: {
    color: "#059669",
    fillColor: "#10b981",
    radius: 9,
    icon: "⚓", // Fix entry_port icon as anchor
  },
  refinery: {
    color: "#d97706",
    fillColor: "#f59e0b",
    radius: 9,
    icon: "🏭",
  },
};

// ── MapView Component ────────────────────────────────────

export default function MapView({ routes, nodes, vessels, regionalPorts = [] }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const portsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [liveVessels, setLiveVessels] = useState<Record<number, any>>({});
  const [mapReady, setMapReady] = useState(false);

  const aisstreamApiKey = process.env.NEXT_PUBLIC_AISSTREAM_API_KEY;

  // Initialize AISstream WebSocket if API key is present
  useEffect(() => {
    if (!aisstreamApiKey || aisstreamApiKey === "your_aisstream_api_key_here") return;

    console.log("KAVACH: AISstream API Key detected. Initializing live tracking...");
    let ws: WebSocket | null = null;
    let connectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

      ws.onopen = () => {
        console.log("KAVACH: Connected to AISstream.io WebSocket");
        const subscription = {
          Apikey: aisstreamApiKey,
          // Bounding box covering Persian Gulf, Arabian Sea, Gulf of Aden, Indian coast
          BoundingBoxes: [[[0, 40], [30, 85]]],
          FilterMessageTypes: ["PositionReport", "ShipStaticData"]
        };
        ws?.send(JSON.stringify(subscription));
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const mmsi = raw.MetaData?.MMSI;
          if (!mmsi) return;

          setLiveVessels((prev) => {
            const existing = prev[mmsi] || {
              id: `live-${mmsi}`,
              name: raw.MetaData?.ShipName?.trim() || `MMSI: ${mmsi}`,
              type: "Live Vessel",
              cargo_type: "Crude/Fuel Cargo",
              lat: raw.MetaData?.latitude || 0,
              lng: raw.MetaData?.longitude || 0,
              heading: 0,
              speed_knots: 12,
              destination: "Unavailable",
              eta: "Unavailable",
              status: "UNDERWAY",
              route_id: "live_ais",
              isLive: true
            };

            if (raw.MessageType === "PositionReport") {
              const posReport = raw.Message.PositionReport;
              existing.lat = posReport.Latitude;
              existing.lng = posReport.Longitude;
              existing.heading = posReport.TrueHeading || posReport.Cog || 0;
              existing.speed_knots = posReport.Sog || 12;
              existing.status = posReport.NavigationalStatus === 0 ? "UNDERWAY" : posReport.NavigationalStatus === 1 ? "AT_ANCHOR" : "UNDERWAY";
            }

            if (raw.MessageType === "ShipStaticData") {
              const statData = raw.Message.ShipStaticData;
              existing.name = statData.Name?.trim() || existing.name;
              existing.destination = statData.Destination?.trim() || "Unavailable";

              const typeCode = statData.Type;
              // Filter: Only show Tankers (80-89) which carry crude, fuels, gases, chemicals
              if (typeCode >= 80 && typeCode <= 89) {
                existing.type = typeCode === 82 ? "LPG Tanker" : typeCode === 81 ? "LNG Carrier" : "Crude/Product Tanker";
                existing.cargo_type = "Hydrocarbon Fuel";
              } else {
                // If it is not a tanker, discard this vessel
                const { [mmsi]: _, ...rest } = prev;
                return rest;
              }

              if (statData.Eta) {
                const { Month, Day, Hour, Minute } = statData.Eta;
                if (Month && Day) {
                  existing.eta = `${Day}/${Month} ${Hour.toString().padStart(2, '0')}:${Minute.toString().padStart(2, '0')}`;
                }
              }
            }

            return { ...prev, [mmsi]: existing };
          });
        } catch (e) {
          // Silent parsing error
        }
      };

      ws.onerror = (err) => {
        console.error("AISstream WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("AISstream WebSocket closed, retrying in 5s...");
        connectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (connectTimeout) clearTimeout(connectTimeout);
      ws?.close();
    };
  }, [aisstreamApiKey]);

  // Initialize map on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 55],
      zoom: 4,
      zoomControl: false,
      attributionControl: true,
      minZoom: 2,
      maxZoom: 12,
    });

    // CartoDB Positron light basemap
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(map);

    // Layer group for all dynamic content
    layerGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    setMapReady(true);

    // Expose zoom functions on window
    (window as any).kavachZoomIn = () => {
      map.zoomIn();
    };
    (window as any).kavachZoomOut = () => {
      map.zoomOut();
    };

    return () => {
      delete (window as any).kavachZoomIn;
      delete (window as any).kavachZoomOut;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update layers when data changes
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // ── Draw Routes ─────────────────────────────────────

    for (const route of routes) {
      if (!route.properties.visible) continue;

      const latlngs: L.LatLngExpression[] = route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      );

      const status = route.properties.status;
      const color = route.properties.color;

      const polyline = L.polyline(latlngs, {
        color,
        weight: status === "BLOCKED" ? 2.5 : status === "REROUTED" ? 3 : 2,
        opacity: status === "BLOCKED" ? 0.8 : 0.75,
        dashArray:
          status === "BLOCKED"
            ? "8, 6"
            : status === "REROUTED"
              ? "12, 4"
              : undefined,
        lineJoin: "round",
        lineCap: "round",
      });

      // Tooltip
      polyline.bindTooltip(
        `<div class="kavach-tooltip">
          <strong>${route.properties.label}</strong><br/>
          <span style="color:${color}">${status}</span> · ${(route.properties.capacity_bpd / 1000).toFixed(0)}K BPD
        </div>`,
        {
          sticky: true,
          direction: "top",
          className: "kavach-map-tooltip",
        }
      );

      // Add flow arrow decorators via custom pane markers on rerouted paths
      if (status === "REROUTED" || status === "PRIMARY") {
        const midIdx = Math.floor(latlngs.length / 2);
        const midPoint = latlngs[midIdx] as [number, number];

        const arrowMarker = L.marker(midPoint, {
          icon: L.divIcon({
            html: `<div style="
              width: 20px;
              height: 20px;
              background: ${color};
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              color: white;
              font-weight: bold;
            ">→</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            className: "",
          }),
        });
        layerGroup.addLayer(arrowMarker);
      }

      layerGroup.addLayer(polyline);
    }

    // ── Draw Nodes ───────────────────────────────────────

    for (const node of nodes) {
      const [lng, lat] = node.geometry.coordinates;
      const nodeType = node.properties.type;
      const style = NODE_STYLE[nodeType] ?? NODE_STYLE.entry_port;
      const isBlocked = node.properties.isBlocked;

      const iconColor = isBlocked ? "#e11d48" : style.color;
      const bgColor = isBlocked ? "#ffe4e6" : style.fillColor;

      const customNodeIcon = L.divIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative">
            <div style="
              width:${style.radius * 2}px;
              height:${style.radius * 2}px;
              background:${bgColor};
              border:2.5px solid ${iconColor};
              border-radius:50%;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:12px;
              box-shadow:0 2px 6px rgba(0,0,0,0.15);
            ">
              ${style.icon}
            </div>
            <!-- Permanent map label -->
            <div style="
              margin-top:4px;
              background:rgba(255,255,255,0.95);
              border:1px solid #cbd5e1;
              border-radius:4px;
              padding:1px 5px;
              font-size:9px;
              font-weight:700;
              color:#1e293b;
              white-space:nowrap;
              box-shadow:0 1px 3px rgba(0,0,0,0.05);
            ">
              ${node.properties.label}
            </div>
          </div>
        `,
        iconSize: [80, 45],
        iconAnchor: [40, style.radius],
        className: ""
      });

      const marker = L.marker([lat, lng], {
        icon: customNodeIcon
      });

      // Popup content
      const wpi = node.properties.wpi_details;
      const wpiHtml = wpi ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#334155;line-height:1.4">
          <div style="font-weight:700;color:#1e3a8a;text-transform:uppercase;font-size:9px;letter-spacing:0.5px;margin-bottom:4px">WPI Particulars (NGA #150)</div>
          <div>Port ID: <strong>WPI-${wpi.port_id}</strong></div>
          <div>Registry Name: <strong>${wpi.port_name}</strong></div>
          <div>Size: <strong>${wpi.port_size || 'N/A'}</strong></div>
          <div>Max Vessel: <strong>${wpi.max_vessel_size || 'N/A'}</strong></div>
          ${wpi.channel_depth_max_m ? `<div>Max Channel Depth: <strong>${wpi.channel_depth_max_m}m</strong></div>` : ""}
          ${wpi.oil_terminal_depth_max_m ? `<div>Oil Terminal Depth: <strong>${wpi.oil_terminal_depth_max_m}m</strong></div>` : ""}
          ${wpi.mean_tidal_range_m ? `<div>Mean Tidal Range: <strong>${wpi.mean_tidal_range_m}m</strong></div>` : ""}
          ${wpi.restriction_swell || wpi.restriction_tide ? `
            <div style="margin-top:4px;color:#b91c1c;font-weight:600">
              Restrictions: ${[wpi.restriction_swell ? "Heavy Swell" : "", wpi.restriction_tide ? "Tidal Limit" : ""].filter(Boolean).join(", ")}
            </div>
          ` : ""}
        </div>
      ` : "";

      const popupContent = `
        <div style="min-width:200px;font-family:Inter,sans-serif">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:16px">${style.icon}</span>
            <div>
              <strong style="font-size:12px;color:#0f172a">${node.properties.label}</strong><br/>
              <span style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">${nodeType.replace("_", " ")}</span>
            </div>
          </div>
          ${isBlocked ? '<div style="background:#ffe4e6;color:#be123c;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:6px">⚠ BLOCKED</div>' : ""}
          <div style="font-size:11px;color:#475569;line-height:1.5">${node.properties.description}</div>
          ${node.properties.capacity_bpd ? `<div style="margin-top:6px;font-size:10px;color:#64748b">Capacity: <strong>${(node.properties.capacity_bpd / 1000).toFixed(0)}K BPD</strong></div>` : ""}
          ${node.properties.strategic_risk ? `<div style="font-size:10px;color:#64748b">Risk: <strong style="color:#e11d48">${node.properties.strategic_risk}</strong></div>` : ""}
          <div style="font-size:10px;color:#94a3b8;margin-top:4px">${node.properties.country}</div>
          ${wpiHtml}
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 260,
        className: "kavach-popup",
      });

      marker.bindTooltip(node.properties.label, {
        permanent: false,
        direction: "top",
        className: "kavach-tooltip",
        offset: [0, -style.radius - 4],
      });

      layerGroup.addLayer(marker);
    }

    // NGA Regional Ports rendering moved to viewport-filtering useEffect below

    // ── Draw Vessels ─────────────────────────────────────
    const allVessels = [...vessels, ...Object.values(liveVessels)];

    for (const vessel of allVessels) {
      const statusColor =
        vessel.isLive
          ? "#8b5cf6" // Distinct purple for live vessels
          : vessel.status === "REROUTING"
            ? "#f59e0b"
            : vessel.status === "AT_ANCHOR"
              ? "#64748b"
              : "#1e3a8a";

      const vesselIcon = L.divIcon({
        html: `<div style="
          position:relative;
          width:12px;
          height:18px;
          transform:rotate(${vessel.heading}deg);
        ">
          <div style="
            width:12px;
            height:18px;
            background:${statusColor};
            clip-path:polygon(50% 0%, 100% 100%, 50% 75%, 0% 100%);
            border:1px solid white;
            filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3));
          "></div>
          ${vessel.status === "REROUTING" ? `
          <div style="
            position:absolute;
            top:-4px;
            right:-4px;
            width:8px;
            height:8px;
            background:#f59e0b;
            border-radius:50%;
            border:1.5px solid white;
            animation:blink-dot 1.2s infinite;
          "></div>` : ""}
          ${vessel.isLive ? `
          <div style="
            position:absolute;
            top:-4px;
            right:-4px;
            width:8px;
            height:8px;
            background:#10b981;
            border-radius:50%;
            border:1.5px solid white;
            animation:blink-dot 1.2s infinite;
          "></div>` : ""}
        </div>`,
        iconSize: [12, 18],
        iconAnchor: [6, 9],
        className: "",
      });

      const vesselMarker = L.marker([vessel.lat, vessel.lng], {
        icon: vesselIcon,
        zIndexOffset: 1000,
      });

      // Get technical registry details (fall back to realistic seeded mock if not in database)
      const reg = (realVessels as Record<string, any>)[vessel.name] || {
        imo: vessel.imo || (9000000 + (parseInt(vessel.id.replace(/\D/g, '')) || 0) % 999999),
        mmsi: vessel.mmsi || (parseInt(vessel.id.replace(/\D/g, '')) || 419001000),
        flag: vessel.flag || (vessel.name.includes("Desh") || vessel.name.includes("Urja") || vessel.name.includes("Sagar") ? "India 🇮🇳" : "Panama 🇵🇦"),
        class: vessel.type || "Crude Oil Tanker",
        dwt_tons: 150000 + ((parseInt(vessel.id.replace(/\D/g, '')) || 0) % 150000),
        length_m: 274,
        beam_m: 48,
        max_draft_m: 16.0,
        build_year: 2015 + ((parseInt(vessel.id.replace(/\D/g, '')) || 0) % 8),
        shipyard: "Hyundai Heavy Industries, South Korea",
        crude_capacity_bbl: 1000000
      };

      const vesselPopup = `
        <div style="min-width:200px;font-family:Inter,sans-serif">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;display:flex;align-items:center;justify-content:between;gap:6px">
            <span>🚢 ${vessel.name}</span>
            ${vessel.isLive ? '<span style="background:#eedffc;color:#6d28d9;font-size:9px;font-weight:800;padding:1px 4px;border-radius:3px;text-transform:uppercase">LIVE AIS</span>' : ''}
          </div>
          <div style="font-size:11px;color:#475569;margin-bottom:6px">
            ${vessel.type} · ${vessel.cargo_type}
          </div>
          <div style="background:${vessel.isLive ? "#f5f3ff" : vessel.status === "REROUTING" ? "#fef3c7" : "#dbeafe"};border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;text-transform:uppercase;color:${vessel.isLive ? "#6d28d9" : vessel.status === "REROUTING" ? "#92400e" : "#1e40af"};margin-bottom:6px">
            Status: ${vessel.status}
          </div>
          <div style="font-size:11px;color:#64748b">Destination: <strong>${vessel.destination}</strong></div>
          ${vessel.eta ? `<div style="font-size:11px;color:#64748b">Scheduled ETA: <strong>${vessel.eta}</strong></div>` : ''}
          <div style="font-size:11px;color:#64748b">Speed: <strong>${vessel.speed_knots} knots</strong></div>
          
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#334155;line-height:1.4">
            <div style="font-weight:700;color:#6d28d9;text-transform:uppercase;font-size:9px;letter-spacing:0.5px;margin-bottom:4px">Technical Registry (Lloyd's Spec)</div>
            <div>IMO Number: <strong>${reg.imo}</strong></div>
            <div>MMSI: <strong>${reg.mmsi}</strong></div>
            <div>Flag Registry: <strong>${reg.flag}</strong></div>
            <div>Classification: <strong>${reg.class}</strong></div>
            <div>Deadweight (DWT): <strong>${reg.dwt_tons.toLocaleString()} tons</strong></div>
            <div>Dimensions: <strong>${reg.length_m}m x ${reg.beam_m}m</strong></div>
            <div>Max Draft: <strong>${reg.max_draft_m}m</strong></div>
            <div>Build Year: <strong>${reg.build_year} (${reg.shipyard})</strong></div>
            <div>Capacity: <strong>${reg.crude_capacity_bbl.toLocaleString()} bbls</strong></div>
          </div>
        </div>
      `;

      vesselMarker.bindPopup(vesselPopup);
      vesselMarker.bindTooltip(vessel.name, {
        direction: "top",
        className: "kavach-tooltip",
      });

      layerGroup.addLayer(vesselMarker);
    }

    // ── Map Legend ───────────────────────────────────────

    const existingLegends = document.querySelectorAll(".kavach-legend");
    existingLegends.forEach((l) => l.remove());

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "kavach-legend");
      div.style.cssText = `
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 14px;
        font-family: Inter, sans-serif;
        font-size: 11px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        min-width: 150px;
      `;
      div.innerHTML = `
        <div style="font-weight:700;color:#0f172a;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Map Legend</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:24px;height:2px;background:#1e3a8a;border-radius:2px"></div>
            <span style="color:#475569">Operational Route</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:24px;height:2px;background:#10b981;border-radius:2px;border-top:2px dashed #10b981"></div>
            <span style="color:#475569">Rerouted Path</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:24px;height:2px;background:#e11d48;border-radius:2px;border-top:2px dashed #e11d48"></div>
            <span style="color:#475569">Blocked Lane</span>
          </div>
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:10px;height:10px;background:#3b82f6;border-radius:50%;border:2px solid #1e3a8a"></div>
              <span style="color:#475569">Supplier Terminal</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:10px;height:10px;background:#f43f5e;border-radius:50%;border:2px solid #be123c"></div>
              <span style="color:#475569">Chokepoint</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:10px;height:10px;background:#10b981;border-radius:50%;border:2px solid #059669"></div>
              <span style="color:#475569">Indian Port</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:10px;height:10px;background:#f59e0b;border-radius:50%;border:2px solid #d97706"></div>
              <span style="color:#475569">Refinery</span>
            </div>
            <div style="margin-top:2px;padding-top:4px;border-top:1px solid #f1f5f9;display:flex;flex-direction:column;gap:4px">
              <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Strategic Supply Chain</div>
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:10px;height:10px;background:#3b82f6;border-radius:50%;border:2px solid #1e3a8a;display:flex;align-items:center;justify-content:center;font-size:6px;color:#fff">⚓</div>
                <span style="color:#475569">Global Export Origin</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:10px;height:10px;background:#10b981;border-radius:50%;border:2px solid #047857;display:flex;align-items:center;justify-content:center;font-size:6px;color:#fff">⚓</div>
                <span style="color:#475569">Indian Import Refinery</span>
              </div>
            </div>
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    // ── Fit bounds ───────────────────────────────────────

    if (nodes.length > 0) {
      const bounds = L.latLngBounds(
        nodes.map((n) => [
          n.geometry.coordinates[1],
          n.geometry.coordinates[0],
        ] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }

  }, [routes, nodes, vessels]);

  // Render all strategically meaningful ports on the map permanently
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!portsLayerGroupRef.current) {
      portsLayerGroupRef.current = L.layerGroup().addTo(map);
    }
    const portsLayer = portsLayerGroupRef.current;
    portsLayer.clearLayers();

    // Render all regionalPorts (which are the curated strategic ports)
    for (const rPort of regionalPorts) {
      // Avoid duplicating primary nodes (which are already rendered on map via nodes prop)
      const isPrimaryNode = nodes.some(n => 
        n.properties.label.toUpperCase().includes(rPort.name.toUpperCase()) || 
        (rPort.name.toUpperCase().includes("SIKKA") && n.properties.id === "jamnagar_port") ||
        (rPort.name.toUpperCase().includes("MUMBAI") && n.properties.id === "mumbai_port") ||
        (rPort.name.toUpperCase().includes("MANGALORE") && n.properties.id === "new_mangalore_port")
      );
      if (isPrimaryNode) continue;

      const isExport = rPort.portType === "export";
      const markerColor = isExport ? "#3b82f6" : "#10b981"; // blue for export origin, green for Indian import
      const borderColor = isExport ? "#1e3a8a" : "#047857";

      const rPortIcon = L.divIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;position:relative">
            <div style="
              width:18px;
              height:18px;
              background:${markerColor};
              border:1.5px solid ${borderColor};
              border-radius:50%;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:10px;
              color:#ffffff;
              box-shadow:0 1px 4px rgba(0,0,0,0.3);
            ">⚓</div>
            <div style="
              margin-top:2px;
              background:rgba(255,255,255,0.85);
              border:1px solid #e2e8f0;
              border-radius:3px;
              padding:1px 4px;
              font-size:8px;
              font-weight:600;
              color:#334155;
              white-space:nowrap;
            ">
              ${rPort.name.split(' (')[0]}
            </div>
          </div>
        `,
        iconSize: [60, 40],
        iconAnchor: [30, 9],
        className: ""
      });

      const rPortMarker = L.marker([rPort.lat, rPort.lng], {
        icon: rPortIcon,
      });

      const crudeList = rPort.crude_types ? rPort.crude_types.join(", ") : "Various";

      const rPortPopup = `
        <div style="min-width:200px;font-family:Inter,sans-serif;padding:2px">
          <div style="font-weight:700;color:#1e293b;font-size:12px;margin-bottom:2px;display:flex;align-items:center;gap:4px">
            <span>⚓</span> ${rPort.name}
          </div>
          <div style="font-size:10px;color:#64748b;margin-bottom:6px;font-weight:500">
            ${rPort.country} · ${isExport ? "Export Terminal" : "Import Refinery Port"}
          </div>
          <div style="font-size:11px;color:#334155;background:#f8fafc;padding:6px;border-radius:4px;margin-bottom:6px;border-left:2.5px solid ${markerColor}">
            ${rPort.role || "Key logistics node in India's energy network."}
          </div>
          <div style="font-size:10px;color:#475569;display:flex;flex-direction:column;gap:2px">
            <div><strong>Crude Grains:</strong> ${crudeList}</div>
            ${isExport && rPort.india_share_pct > 0 ? `<div><strong>Est. India Supply Share:</strong> <span style="color:#2563eb;font-weight:700">${rPort.india_share_pct}%</span></div>` : ""}
          </div>
        </div>
      `;

      rPortMarker.bindPopup(rPortPopup);
      rPortMarker.bindTooltip(rPort.name, {
        direction: "top",
        className: "kavach-tooltip",
      });

      portsLayer.addLayer(rPortMarker);
    }
  }, [regionalPorts, nodes, mapReady]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
