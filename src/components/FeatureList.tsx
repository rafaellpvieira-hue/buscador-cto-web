import React, { useState } from 'react';
import { KmzFeature, GeometryType } from '../types/kmz';
import { Search, MapPin, Navigation, Square, Filter, ChevronRight, Folder } from 'lucide-react';

interface FeatureListProps {
  features: KmzFeature[];
  selectedFeatureId: string | null;
  onSelectFeature: (feature: KmzFeature) => void;
  folders: string[];
  selectedFolder: string | 'all';
  onSelectFolder: (folder: string | 'all') => void;
  visibleTypes: { points: boolean; lines: boolean; polygons: boolean };
}

export const FeatureList: React.FC<FeatureListProps> = ({
  features,
  selectedFeatureId,
  onSelectFeature,
  folders,
  selectedFolder,
  onSelectFolder,
  visibleTypes,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | GeometryType>('ALL');

  const filteredFeatures = features.filter((feat) => {
    // Folder filter
    if (selectedFolder !== 'all' && feat.folder !== selectedFolder) return false;

    // Type filter
    if (typeFilter !== 'ALL' && feat.geometryType !== typeFilter) return false;

    // Visible types toggle filter
    if (feat.geometryType === 'Point' && !visibleTypes.points) return false;
    if (feat.geometryType === 'LineString' && !visibleTypes.lines) return false;
    if (feat.geometryType === 'Polygon' && !visibleTypes.polygons) return false;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = feat.name.toLowerCase().includes(term);
      const matchDesc = feat.description.toLowerCase().includes(term);
      const matchFolder = feat.folder.toLowerCase().includes(term);
      const matchProps = Object.values(feat.properties).some((v) =>
        String(v).toLowerCase().includes(term)
      );
      return matchName || matchDesc || matchFolder || matchProps;
    }

    return true;
  });

  const getGeometryIcon = (type: GeometryType) => {
    switch (type) {
      case 'Point':
        return <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
      case 'LineString':
        return <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'Polygon':
        return <Square className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />;
      default:
        return <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div id="feature-list-sidebar" className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Search and Filters */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/70 dark:bg-slate-850/50">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-features"
            type="text"
            placeholder="Buscar elementos, atributos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              &times;
            </button>
          )}
        </div>

        {/* Folder filter dropdown if more than 1 folder */}
        {folders.length > 1 && (
          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              id="select-folder-filter"
              value={selectedFolder}
              onChange={(e) => onSelectFolder(e.target.value)}
              className="w-full text-xs py-1 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas as Pastas ({folders.length})</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  Pasta: {f}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quick geometry type filter buttons */}
        <div className="flex gap-1 overflow-x-auto text-[11px] pb-0.5 scrollbar-none">
          {(['ALL', 'Point', 'LineString', 'Polygon'] as const).map((t) => {
            const label =
              t === 'ALL'
                ? 'Todos'
                : t === 'Point'
                ? 'Pontos'
                : t === 'LineString'
                ? 'Linhas'
                : 'Polígonos';
            const isSelected = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
        {filteredFeatures.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Nenhum elemento encontrado
            </p>
            <p>Tente ajustar os termos de busca ou filtros ativos.</p>
          </div>
        ) : (
          filteredFeatures.map((feat) => {
            const isSelected = feat.id === selectedFeatureId;
            const propCount = Object.keys(feat.properties).length;

            return (
              <button
                key={feat.id}
                id={`feature-item-${feat.id}`}
                type="button"
                onClick={() => onSelectFeature(feat)}
                className={`w-full text-left p-3 flex items-start justify-between gap-2.5 transition group ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-4 border-blue-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-850/60'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 p-1 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getGeometryIcon(feat.geometryType)}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-xs truncate leading-tight ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600'
                    }`}>
                      {feat.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">{feat.folder}</span>
                      {feat.metrics?.lengthKm && (
                        <span>&bull; {feat.metrics.lengthKm.toFixed(2)} km</span>
                      )}
                      {feat.metrics?.areaKm2 && (
                        <span>&bull; {feat.metrics.areaKm2.toFixed(2)} km²</span>
                      )}
                      {propCount > 0 && (
                        <span className="text-slate-400 text-[10px]">({propCount} campos)</span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                  isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'
                }`} />
              </button>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between items-center">
        <span>Exibindo: <b>{filteredFeatures.length}</b> de {features.length}</span>
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Limpar busca
          </button>
        )}
      </div>
    </div>
  );
};
