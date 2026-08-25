import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { KmzFeature, KmzMetadata } from '../types/kmz';
import {
  Layers,
  Maximize2,
  Eye,
  EyeOff,
  Navigation2,
  ExternalLink,
  Zap,
  Compass,
} from 'lucide-react';

// Fix for default Leaflet marker icons in React/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewerProps {
  features: KmzFeature[];
  metadata: KmzMetadata;
  selectedFeatureId: string | null;
  onSelectFeature: (feature: KmzFeature) => void;
  visibleTypes: { points: boolean; lines: boolean; polygons: boolean };
  onToggleType: (type: 'points' | 'lines' | 'polygons') => void;
  selectedFolder: string | 'all';
  userLocation?: { lat: number; lng: number } | null;
  onOpenRequestForFeature?: (feature: KmzFeature) => void;
}

const BASE_MAPS: Record<
  string,
  { name: string; url: string; attribution: string }
> = {
  satellite: {
    name: 'Satélite Híbrido (Google/Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
  street: {
    name: 'Mapa de Ruas (OpenStreetMap)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  dark: {
    name: 'Modo Escuro (CartoDB Dark)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO, OpenStreetMap contributors',
  },
  topo: {
    name: 'Topográfico / Relevo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'OpenTopoMap',
  },
};

export const MapViewer: React.FC<MapViewerProps> = ({
  features,
  metadata,
  selectedFeatureId,
  onSelectFeature,
  visibleTypes,
  onToggleType,
  selectedFolder,
  userLocation,
  onOpenRequestForFeature,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const featureLayersGroupRef = useRef<L.FeatureGroup | null>(null);
  const userLocationMarkerRef = useRef<L.Layer | null>(null);
  const userRouteLineRef = useRef<L.Polyline | null>(null);
  const layerMapRef = useRef<Map<string, L.Layer>>(new Map());

  const [currentBaseMap, setCurrentBaseMap] = useState<string>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showTypeToggles, setShowTypeToggles] = useState(false);

  // Initialize Map & Watch Container Resize
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center in Brazil (São Paulo / Santa Catarina / generic)
    const map = L.map(mapContainerRef.current, {
      center: [-26.24, -49.38],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const baseConfig = BASE_MAPS[currentBaseMap];
    const tileLayer = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    baseTileLayerRef.current = tileLayer;

    const featureGroup = L.featureGroup().addTo(map);
    featureLayersGroupRef.current = featureGroup;
    mapInstanceRef.current = map;

    // Recalcula o tamanho do mapa após montagem
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Observa mudanças de dimensão da tela/container para recalcular o mapa automaticamente
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileLayerRef.current) return;
    const map = mapInstanceRef.current;
    map.removeLayer(baseTileLayerRef.current);

    const baseConfig = BASE_MAPS[currentBaseMap];
    const newTileLayer = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    newTileLayer.bringToBack();
    baseTileLayerRef.current = newTileLayer;
  }, [currentBaseMap]);

  // Render KMZ Features on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const fg = featureLayersGroupRef.current;
    if (!map || !fg) return;

    fg.clearLayers();
    layerMapRef.current.clear();

    const filteredFeatures = features.filter((feat) => {
      if (selectedFolder !== 'all' && feat.folder !== selectedFolder) return false;
      if (feat.geometryType === 'Point' && !visibleTypes.points) return false;
      if (feat.geometryType === 'LineString' && !visibleTypes.lines) return false;
      if (feat.geometryType === 'Polygon' && !visibleTypes.polygons) return false;
      return true;
    });

    filteredFeatures.forEach((feat) => {
      const isSelected = feat.id === selectedFeatureId;
      const isCto =
        feat.name.toLowerCase().includes('cto') ||
        feat.folder.toLowerCase().includes('cto') ||
        feat.geometryType === 'Point';

      const strokeColor = isCto ? '#00a86b' : (feat.style?.color || '#3b82f6');
      const fillColor = isSelected ? '#ef4444' : strokeColor;
      const weight = isSelected ? 4 : (feat.style?.strokeWidth || 2.5);

      let leafletLayer: L.Layer | null = null;

      if (feat.geometryType === 'Point' && feat.coordinates.length > 0) {
        const c = feat.coordinates[0];
        const markerBg = isSelected ? '#ef4444' : '#00a86b';

        // Custom DivIcon for CTO points with high contrast badge
        const customIcon = L.divIcon({
          className: 'custom-kmz-marker',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 border-2 border-white ${
                isSelected ? 'scale-125 ring-4 ring-red-400' : 'hover:scale-110 shadow-black/60'
              }" style="background-color: ${markerBg}; color: white;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              ${isSelected ? '<div class="absolute -inset-1 rounded-full animate-ping opacity-75 bg-red-400"></div>' : ''}
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 30],
          popupAnchor: [0, -28],
        });

        const marker = L.marker([c.lat, c.lng], { icon: customIcon });
        leafletLayer = marker;
      } else if (feat.geometryType === 'LineString' && feat.coordinates.length >= 2) {
        const latLngs = feat.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
        const polyline = L.polyline(latLngs, {
          color: isSelected ? '#ef4444' : '#00a86b',
          weight: isSelected ? 5 : weight,
          opacity: 0.9,
          lineJoin: 'round',
        });
        leafletLayer = polyline;
      } else if (feat.geometryType === 'Polygon' && feat.coordinates.length >= 3) {
        let latLngs: any = feat.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
        if (feat.polygonRings && feat.polygonRings.length > 1) {
          latLngs = feat.polygonRings.map((ring) => ring.map((c) => [c.lat, c.lng] as [number, number]));
        }

        const polygon = L.polygon(latLngs, {
          color: isSelected ? '#ef4444' : strokeColor,
          weight: isSelected ? 3.5 : weight,
          fillColor: isSelected ? '#f87171' : fillColor,
          fillOpacity: isSelected ? 0.5 : 0.35,
        });
        leafletLayer = polygon;
      }

      if (leafletLayer) {
        const coord = feat.coordinates[0];
        const mapsUrl = coord ? `https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lng}` : '#';
        const wazeUrl = coord ? `https://waze.com/ul?ll=${coord.lat},${coord.lng}&navigate=yes` : '#';
        const baterCtoMsg = encodeURIComponent(`*Bater CTO:* ${feat.name}\n  *Cidade:* ${feat.cidadeOficial || ''}\n  *Protocolo:* `);
        const baterCtoUrl = `https://api.whatsapp.com/send?text=${baterCtoMsg}`;

        const popupHtml = `
          <div class="p-1 min-w-[240px] max-w-[280px] font-sans text-slate-900">
            <div class="flex items-center justify-between gap-1.5 text-xs text-[#00a86b] font-bold mb-1">
              <span>${feat.cidadeOficial || feat.folder || 'Rede Fibra'}</span>
              <span class="text-[10px] text-slate-500 font-normal">${feat.geometryType}</span>
            </div>
            <h4 class="font-extrabold text-slate-900 text-sm leading-tight">${feat.name}</h4>
            ${
              coord
                ? `<p class="text-[11px] text-slate-500 font-mono mt-0.5">${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}</p>`
                : ''
            }
            ${feat.description ? `<div class="text-xs text-slate-600 mt-1 line-clamp-2">${feat.description}</div>` : ''}

            <div class="mt-2.5 pt-2 border-t border-slate-200 flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5">
                <a href="${mapsUrl}" target="_blank" rel="noreferrer" class="flex-1 py-1 px-2 text-center rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700">
                  🗺️ Google Maps
                </a>
                <a href="${wazeUrl}" target="_blank" rel="noreferrer" class="flex-1 py-1 px-2 text-center rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700">
                  🧭 Waze
                </a>
              </div>
              <a href="${baterCtoUrl}" target="_blank" rel="noreferrer" class="w-full py-1 px-2 text-center rounded bg-[#00a86b] hover:bg-[#008f5b] text-[11px] font-bold text-white shadow-sm flex items-center justify-center gap-1">
                📲 Bater CTO no WhatsApp
              </a>
            </div>
          </div>
        `;

        leafletLayer.bindPopup(popupHtml, { maxWidth: 300 });

        leafletLayer.on('click', () => {
          onSelectFeature(feat);
        });

        fg.addLayer(leafletLayer);
        layerMapRef.current.set(feat.id, leafletLayer);
      }
    });

    // Fit map bounds on initial load if we have valid bounds
    if (metadata.bounds && fg.getLayers().length > 0 && !selectedFeatureId) {
      const bounds = L.latLngBounds(
        [metadata.bounds.minLat, metadata.bounds.minLng],
        [metadata.bounds.maxLat, metadata.bounds.maxLng]
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [features, selectedFolder, visibleTypes, selectedFeatureId, metadata.bounds]);

  // Handle selected feature focus
  useEffect(() => {
    if (!selectedFeatureId || !mapInstanceRef.current) return;
    const layer = layerMapRef.current.get(selectedFeatureId);
    if (!layer) return;

    const map = mapInstanceRef.current;
    if (layer instanceof L.Marker) {
      map.flyTo(layer.getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.8 });
      layer.openPopup();
    } else if (layer instanceof L.Polyline || layer instanceof L.Polygon) {
      const bounds = layer.getBounds();
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 16, duration: 0.8 });
      layer.openPopup();
    }
  }, [selectedFeatureId]);

  // Render User GPS Location & Route line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLocationMarkerRef.current) {
      map.removeLayer(userLocationMarkerRef.current);
      userLocationMarkerRef.current = null;
    }
    if (userRouteLineRef.current) {
      map.removeLayer(userRouteLineRef.current);
      userRouteLineRef.current = null;
    }

    if (userLocation) {
      const gpsIcon = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
              <div class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></div>
            </div>
            <div class="absolute -inset-3 rounded-full bg-blue-500/25 animate-pulse"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: gpsIcon })
        .bindPopup('<div class="text-xs font-bold text-slate-900">📍 Sua Posição Atual (GPS do Técnico)</div>')
        .addTo(map);

      userLocationMarkerRef.current = userMarker;

      // Draw connecting dashed route line
      const selectedFeat = features.find((f) => f.id === selectedFeatureId);
      if (selectedFeat && selectedFeat.coordinates.length > 0) {
        const targetCoord = selectedFeat.coordinates[0];
        const line = L.polyline(
          [
            [userLocation.lat, userLocation.lng],
            [targetCoord.lat, targetCoord.lng],
          ],
          {
            color: '#00a86b',
            dashArray: '6, 8',
            weight: 3.5,
            opacity: 0.9,
          }
        ).addTo(map);
        userRouteLineRef.current = line;
      }
    }
  }, [userLocation, selectedFeatureId, features]);

  const fitAllBounds = () => {
    if (!mapInstanceRef.current || !featureLayersGroupRef.current) return;
    const fg = featureLayersGroupRef.current;
    if (fg.getLayers().length > 0) {
      mapInstanceRef.current.fitBounds(fg.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
  };

  return (
    <div id="kmz-map-container" className="relative w-full h-full min-h-[400px] bg-[#0e1117] overflow-hidden">
      {/* Map Target */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Controls Top-Right */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {/* Layer Styles Menu */}
        <div className="relative">
          <button
            id="btn-toggle-base-layers"
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center gap-1.5 bg-[#0e1117]/90 text-white backdrop-blur-md px-3 py-2 rounded-lg text-xs font-bold shadow-xl hover:bg-[#161a24] border border-[#31333f] transition"
            title="Mudar estilo de mapa"
          >
            <Layers className="w-4 h-4 text-[#00a86b]" />
            <span className="hidden sm:inline">{BASE_MAPS[currentBaseMap].name.split(' ')[0]}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-[#161a24] rounded-xl shadow-2xl border border-[#31333f] py-1.5 z-50 text-xs font-medium">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400">Tipo de Mapa:</div>
              {Object.entries(BASE_MAPS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setCurrentBaseMap(key);
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition ${
                    currentBaseMap === key
                      ? 'bg-[#00a86b]/20 text-emerald-300 font-bold border-l-2 border-[#00a86b]'
                      : 'text-slate-300 hover:bg-[#262730]'
                  }`}
                >
                  <span>{item.name}</span>
                  {currentBaseMap === key && <span className="w-2 h-2 rounded-full bg-[#00a86b]"></span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fit Bounds Button */}
        <button
          id="btn-fit-map-bounds"
          type="button"
          onClick={fitAllBounds}
          className="p-2 bg-[#0e1117]/90 text-white backdrop-blur-md rounded-lg shadow-xl hover:bg-[#161a24] border border-[#31333f] transition"
          title="Enquadrar todas as CTOs no mapa"
        >
          <Maximize2 className="w-4 h-4 text-[#00a86b]" />
        </button>

        {/* Layers Toggles */}
        <button
          id="btn-toggle-type-filters"
          type="button"
          onClick={() => setShowTypeToggles(!showTypeToggles)}
          className="p-2 bg-[#0e1117]/90 text-white backdrop-blur-md rounded-lg shadow-xl hover:bg-[#161a24] border border-[#31333f] transition"
          title="Filtrar camadas (Pontos, Linhas, Polígonos)"
        >
          {visibleTypes.points && visibleTypes.lines && visibleTypes.polygons ? (
            <Eye className="w-4 h-4 text-[#00a86b]" />
          ) : (
            <EyeOff className="w-4 h-4 text-amber-400" />
          )}
        </button>

        {showTypeToggles && (
          <div className="absolute right-0 top-32 w-48 bg-[#161a24] rounded-xl shadow-2xl border border-[#31333f] p-2.5 z-50 text-xs space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Camadas Visíveis:</div>
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={visibleTypes.points}
                onChange={() => onToggleType('points')}
                className="rounded accent-[#00a86b]"
              />
              <span>CTOs / Pontos ({metadata.pointsCount})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={visibleTypes.lines}
                onChange={() => onToggleType('lines')}
                className="rounded accent-[#00a86b]"
              />
              <span>Cabos / Linhas ({metadata.linesCount})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={visibleTypes.polygons}
                onChange={() => onToggleType('polygons')}
                className="rounded accent-[#00a86b]"
              />
              <span>Áreas / Polígonos ({metadata.polygonsCount})</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
