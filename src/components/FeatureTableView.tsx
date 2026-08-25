import React, { useState, useMemo } from 'react';
import { KmzFeature } from '../types/kmz';
import { Search, Download, ArrowUpDown, MapPin, Navigation, Square } from 'lucide-react';

interface FeatureTableViewProps {
  features: KmzFeature[];
  onSelectFeature: (feature: KmzFeature) => void;
  selectedFeatureId: string | null;
}

export const FeatureTableView: React.FC<FeatureTableViewProps> = ({
  features,
  onSelectFeature,
  selectedFeatureId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'folder' | 'type'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Extract all distinct property keys across all features
  const propertyKeys = useMemo(() => {
    const keysSet = new Set<string>();
    features.forEach((f) => {
      Object.keys(f.properties).forEach((k) => keysSet.add(k));
    });
    return Array.from(keysSet);
  }, [features]);

  const filteredAndSorted = useMemo(() => {
    return features
      .filter((f) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const matchBase =
          f.name.toLowerCase().includes(term) ||
          f.folder.toLowerCase().includes(term) ||
          f.geometryType.toLowerCase().includes(term);
        const matchProps = Object.values(f.properties).some((v) =>
          String(v).toLowerCase().includes(term)
        );
        return matchBase || matchProps;
      })
      .sort((a, b) => {
        let valA = '';
        let valB = '';
        if (sortField === 'name') {
          valA = a.name;
          valB = b.name;
        } else if (sortField === 'folder') {
          valA = a.folder;
          valB = b.folder;
        } else if (sortField === 'type') {
          valA = a.geometryType;
          valB = b.geometryType;
        }
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
  }, [features, searchTerm, sortField, sortAsc]);

  const handleSort = (field: 'name' | 'folder' | 'type') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const exportCsv = () => {
    const headers = ['ID', 'Nome', 'Tipo', 'Pasta', 'Latitude', 'Longitude', 'Altitude', ...propertyKeys];
    const rows = filteredAndSorted.map((f) => {
      const c = f.coordinates[0] || { lat: 0, lng: 0 };
      const propValues = propertyKeys.map((k) => `"${(f.properties[k] || '').toString().replace(/"/g, '""')}"`);
      return [
        `"${f.id}"`,
        `"${f.name.replace(/"/g, '""')}"`,
        `"${f.geometryType}"`,
        `"${f.folder.replace(/"/g, '""')}"`,
        c.lat,
        c.lng,
        c.alt !== undefined ? c.alt : '',
        ...propValues,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dados-kmz-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getGeometryIcon = (type: string) => {
    switch (type) {
      case 'Point':
        return <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline mr-1" />;
      case 'LineString':
        return <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline mr-1" />;
      case 'Polygon':
        return <Square className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 inline mr-1" />;
      default:
        return null;
    }
  };

  return (
    <div id="kmz-feature-table-view" className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-850/50">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-table"
            type="text"
            placeholder="Filtrar tabela por qualquer coluna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:inline">
            <b>{filteredAndSorted.length}</b> linhas
          </span>
          <button
            id="btn-export-csv-table"
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Table Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-sm text-[11px]">
            <tr>
              <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                  <span>Nome</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition" onClick={() => handleSort('type')}>
                <div className="flex items-center gap-1">
                  <span>Geometria</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition" onClick={() => handleSort('folder')}>
                <div className="flex items-center gap-1">
                  <span>Pasta</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Métricas</th>
              <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Coordenadas</th>
              {propertyKeys.map((k) => (
                <th key={k} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredAndSorted.map((f) => {
              const isSelected = f.id === selectedFeatureId;
              const firstCoord = f.coordinates[0];

              return (
                <tr
                  key={f.id}
                  id={`table-row-${f.id}`}
                  onClick={() => onSelectFeature(f)}
                  className={`cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50 font-medium'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-850/60'
                  }`}
                >
                  <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100 font-semibold max-w-[200px] truncate">
                    {f.name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {getGeometryIcon(f.geometryType)}
                    {f.geometryType}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[140px] truncate">
                    {f.folder}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {f.metrics?.lengthKm && <span>{f.metrics.lengthKm.toFixed(2)} km</span>}
                    {f.metrics?.areaKm2 && <span>{f.metrics.areaKm2.toFixed(2)} km²</span>}
                    {!f.metrics?.lengthKm && !f.metrics?.areaKm2 && <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {firstCoord ? `${firstCoord.lat.toFixed(4)}, ${firstCoord.lng.toFixed(4)}` : '-'}
                  </td>
                  {propertyKeys.map((k) => (
                    <td key={k} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-[160px] truncate">
                      {f.properties[k] !== undefined ? String(f.properties[k]) : '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
