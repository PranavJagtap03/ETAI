"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import with ssr:false to prevent SSR issues with Leaflet
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
      <p className="text-sm text-slate-500 font-medium">
        Initializing Maritime Map…
      </p>
      <p className="text-xs text-slate-400 mt-1">
        Loading CartoDB Positron basemap
      </p>
    </div>
  ),
});

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
}

interface MapContainerProps {
  routes: RouteFeature[];
  nodes: NodeFeature[];
  vessels: VesselPosition[];
  regionalPorts?: any[];
  isLoading: boolean;
}

export function MapContainer({
  routes,
  nodes,
  vessels,
  regionalPorts = [],
  isLoading,
}: MapContainerProps) {
  return (
    <div className="relative w-full h-full">
      <MapView routes={routes} nodes={nodes} vessels={vessels} regionalPorts={regionalPorts} />
      {isLoading && (
        <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[1px] pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-4 bg-white/90 shadow-2xl rounded-2xl border border-slate-200/50 pointer-events-auto">
            <div className="w-7 h-7 border-[3px] border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-xs text-slate-700 font-semibold tracking-wide uppercase">
              Recalculating Routes…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
