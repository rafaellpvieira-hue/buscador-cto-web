/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { loadPersistentKmz, clearStoredKmz } from './utils/kmzStorage';
import { KmzFeature, KmzMetadata, KmzParseResult } from './types/kmz';
import { Header } from './components/Header';
import { TelecomTopBar, TelecomTab } from './components/TelecomTopBar';
import { TelecomPanel } from './components/TelecomPanel';
import { MapViewer } from './components/MapViewer';
import { FeatureTableView } from './components/FeatureTableView';
import { FeatureDetailView } from './components/FeatureDetailView';
import { UploadModal } from './components/UploadModal';
import { CodeInstructionsModal } from './components/CodeInstructionsModal';
import { haversineDistance } from './utils/kmzReader';
import {
  MapPin,
  Navigation,
  Square,
  Folder,
  RefreshCw,
  Upload,
  Database,
  Radio,
} from 'lucide-react';

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<KmzParseResult | null>(null);
  const [fileSource, setFileSource] = useState<'indexeddb' | 'public' | 'none'>('none');
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);

  // Telecom Top Bar Tabs
  const [telecomTab, setTelecomTab] = useState<TelecomTab>('search');

  // Selected Feature & Filters
  const [selectedFeature, setSelectedFeature] = useState<KmzFeature | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | 'all'>('all');
  const [visibleTypes, setVisibleTypes] = useState<{
    points: boolean;
    lines: boolean;
    polygons: boolean;
  }>({
    points: true,
    lines: true,
    polygons: true,
  });

  const [activeView, setActiveView] = useState<'split' | 'map' | 'table'>('split');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  // GPS User Location State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Trigger GPS Geolocation
  const handleFindGpsLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocalização não suportada no seu navegador.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setGpsError('Não foi possível obter sua localização GPS. Verifique a permissão do navegador.');
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Load persistent KMZ (from IndexedDB first, then public/dados.kmz)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedFeature(null);

    const { result, source, savedAt } = await loadPersistentKmz();
    setParseResult(result);
    setFileSource(source);
    setSavedAt(savedAt);

    if (!result.success && source === 'none') {
      setError(
        result.error ||
          'Nenhum arquivo KMZ salvo ou encontrado em public/dados.kmz. Faça o upload do seu arquivo .kmz para mantê-lo salvo no sistema.'
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleType = (type: 'points' | 'lines' | 'polygons') => {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleCustomFileLoaded = (result: KmzParseResult, source: 'indexeddb') => {
    setParseResult(result);
    setFileSource(source);
    setError(null);
    setSelectedFeature(null);
    setSelectedFolder('all');
  };

  const handleClearStored = async () => {
    if (window.confirm('Deseja remover o arquivo KMZ salvo no seu navegador?')) {
      await clearStoredKmz();
      await loadData();
    }
  };

  // Export handlers
  const handleExportGeoJson = () => {
    if (!parseResult) return;
    const data = parseResult.geojson || {
      type: 'FeatureCollection',
      features: parseResult.features.map((f) => ({
        type: 'Feature',
        id: f.id,
        properties: {
          name: f.name,
          description: f.description,
          folder: f.folder,
          ...f.properties,
        },
        geometry: {
          type: f.geometryType === 'LineString' ? 'LineString' : f.geometryType === 'Polygon' ? 'Polygon' : 'Point',
          coordinates:
            f.geometryType === 'Point'
              ? [f.coordinates[0]?.lng, f.coordinates[0]?.lat]
              : f.geometryType === 'LineString'
              ? f.coordinates.map((c) => [c.lng, c.lat])
              : [f.coordinates.map((c) => [c.lng, c.lat])],
        },
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${parseResult.metadata.fileName.replace(/\.(kmz|kml)$/i, '') || 'dados'}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportKml = () => {
    if (!parseResult || !parseResult.rawKml) {
      alert('KML bruto não disponível para download.');
      return;
    }
    const blob = new Blob([parseResult.rawKml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${parseResult.metadata.fileName.replace(/\.(kmz|kml)$/i, '') || 'dados'}.kml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!parseResult || parseResult.features.length === 0) return;
    const propertyKeys: string[] = Array.from(
      new Set(parseResult.features.flatMap((f) => Object.keys(f.properties)))
    );
    const headers = ['ID', 'Nome', 'Tipo', 'Pasta', 'Latitude', 'Longitude', ...propertyKeys];
    const rows = parseResult.features.map((f) => {
      const c = f.coordinates[0] || { lat: 0, lng: 0 };
      const propValues = propertyKeys.map(
        (k) => `"${(f.properties[k] || '').toString().replace(/"/g, '""')}"`
      );
      return [
        `"${f.id}"`,
        `"${f.name.replace(/"/g, '""')}"`,
        `"${f.geometryType}"`,
        `"${f.folder.replace(/"/g, '""')}"`,
        c.lat,
        c.lng,
        ...propValues,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${parseResult.metadata.fileName.replace(/\.(kmz|kml)$/i, '') || 'dados'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const features = parseResult?.features || [];
  const metadata = parseResult?.metadata || null;

  // Closest CTO calculation for top bar badge
  const closestCtoInfo = useMemo(() => {
    if (!userLocation || features.length === 0) return null;
    const points = features.filter((f) => f.geometryType === 'Point');
    let minDistance = Infinity;
    let closestName = '';

    points.forEach((f) => {
      if (f.coordinates[0]) {
        const d = haversineDistance(userLocation, f.coordinates[0]);
        if (d < minDistance) {
          minDistance = d;
          closestName = f.name;
        }
      }
    });

    if (minDistance === Infinity) return null;
    return { distance: minDistance, name: closestName };
  }, [userLocation, features]);

  return (
    <div id="kmz-app-root" className="flex flex-col h-screen w-screen bg-[#0e1117] text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        metadata={metadata}
        loading={loading}
        fileSource={fileSource}
        onReload={loadData}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenCodeModal={() => setIsCodeModalOpen(true)}
        onClearStoredKmz={handleClearStored}
        activeView={activeView}
        setActiveView={setActiveView}
        onExportGeoJson={handleExportGeoJson}
        onExportKml={handleExportKml}
        onExportCsv={handleExportCsv}
      />

      {/* Streamlit Exact Telecom Top Bar */}
      <TelecomTopBar
        activeTab={telecomTab}
        onSelectTab={(tab) => {
          setTelecomTab(tab);
          if (activeView === 'table') {
            setActiveView('split');
          }
          if (tab === 'closest-cto' && !userLocation) {
            handleFindGpsLocation();
          }
        }}
        closestCtoDistance={closestCtoInfo?.distance}
        closestCtoName={closestCtoInfo?.name}
        selectedCtoName={selectedFeature?.name}
      />

      {/* Quick Summary Info Bar */}
      {metadata && !loading && parseResult?.success && (
        <div className="bg-[#161a24] border-b border-[#262730] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-200 truncate">
              {metadata.documentName || metadata.fileName || 'Base de CTOs'}
            </span>
            {fileSource === 'indexeddb' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                <Database className="w-3 h-3" />
                Fixado
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 text-slate-300">
              <span className="font-bold text-white">{metadata.totalFeatures}</span>
              <span className="text-[11px] text-slate-400">elementos cadastrados</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-700 text-[11px]">
              <span className="flex items-center gap-1 text-[#00a86b] font-semibold">
                <MapPin className="w-3 h-3" /> {metadata.pointsCount} CTOs
              </span>
              <span className="flex items-center gap-1 text-blue-400">
                <Navigation className="w-3 h-3" /> {metadata.linesCount} Rotas
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <Square className="w-3 h-3" /> {metadata.polygonsCount} Áreas
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <Folder className="w-3 h-3" /> {metadata.folders.length} Pastas
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 relative overflow-hidden flex flex-col bg-[#0e1117]">
        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 z-50 bg-[#0e1117]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#00a86b] animate-spin" />
            <div className="text-center">
              <p className="font-bold text-white text-sm">
                Carregando arquivo KMZ e base de CTOs...
              </p>
              <p className="text-xs text-slate-400">
                Lendo coordenadas geográficas e atributos
              </p>
            </div>
          </div>
        )}

        {/* Empty / Upload State */}
        {!loading && (!parseResult || !parseResult.success) && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-[#161a24] p-8 rounded-2xl shadow-2xl border border-[#31333f] space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#00a86b]/20 text-[#00a86b] flex items-center justify-center mx-auto shadow-inner border border-[#00a86b]/40">
                <Radio className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Nenhum arquivo KMZ fixado
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Faça o upload do seu arquivo <b>.kmz</b> ou <b>.kml</b> da rede óptica. Ele será <b>gravado no seu navegador</b> e continuará disponível ao fechar ou recarregar a página.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  id="btn-empty-state-upload"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="w-full py-3 px-4 bg-[#00a86b] hover:bg-[#008f5b] text-white font-extrabold rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Fazer Upload do Arquivo KMZ</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#0e1117] text-slate-400 text-xs text-left border border-[#262730]">
                <p className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#00a86b]" />
                  Armazenamento Local Persistente:
                </p>
                <p className="text-[11px] leading-relaxed">
                  O arquivo fica fixado permanentemente no IndexedDB do seu dispositivo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Views */}
        {!loading && parseResult && parseResult.success && (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Split View: Telecom Sidebar with Tab Selection */}
            {activeView === 'split' && (
              <TelecomPanel
                activeTab={telecomTab}
                onSelectTab={setTelecomTab}
                features={features}
                selectedFeature={selectedFeature}
                onSelectFeature={(f) => setSelectedFeature(f)}
                userLocation={userLocation}
                onFindGpsLocation={handleFindGpsLocation}
                gpsLoading={gpsLoading}
                gpsError={gpsError}
              />
            )}

            {/* Map View Area */}
            {(activeView === 'split' || activeView === 'map') && (
              <div className="flex-1 h-full relative">
                <MapViewer
                  features={features}
                  metadata={metadata!}
                  selectedFeatureId={selectedFeature?.id || null}
                  onSelectFeature={(f) => setSelectedFeature(f)}
                  visibleTypes={visibleTypes}
                  onToggleType={handleToggleType}
                  selectedFolder={selectedFolder}
                  userLocation={userLocation}
                  onOpenRequestForFeature={(f) => {
                    setSelectedFeature(f);
                    setTelecomTab('request');
                    setActiveView('split');
                  }}
                />
              </div>
            )}

            {/* Table View Area */}
            {activeView === 'table' && (
              <div className="flex-1 h-full">
                <FeatureTableView
                  features={features}
                  onSelectFeature={(f) => {
                    setSelectedFeature(f);
                    setActiveView('split');
                  }}
                  selectedFeatureId={selectedFeature?.id || null}
                />
              </div>
            )}

            {/* Feature Details Inspector Drawer */}
            {selectedFeature && activeView === 'map' && (
              <div className="w-80 md:w-96 h-full absolute right-0 top-0 bottom-0 z-[1050] md:relative md:z-auto">
                <FeatureDetailView
                  feature={selectedFeature}
                  onClose={() => setSelectedFeature(null)}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onLoaded={handleCustomFileLoaded}
      />

      <CodeInstructionsModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
}

@import "tailwindcss";

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
