import React, { useState } from 'react';
import { KmzFeature } from '../types/kmz';
import { MapPin, Navigation, Square, X, Copy, Check, ExternalLink, Info, Layers, Tag } from 'lucide-react';

interface FeatureDetailViewProps {
  feature: KmzFeature | null;
  onClose: () => void;
  onFlyTo?: (feature: KmzFeature) => void;
}

export const FeatureDetailView: React.FC<FeatureDetailViewProps> = ({
  feature,
  onClose,
  onFlyTo,
}) => {
  const [copied, setCopied] = useState(false);

  if (!feature) return null;

  const propEntries = Object.entries(feature.properties);

  const copyCoordinates = () => {
    const coordsStr = feature.coordinates
      .map((c) => `${c.lat}, ${c.lng}${c.alt !== undefined ? `, ${c.alt}m` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(coordsStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getGeometryIcon = () => {
    switch (feature.geometryType) {
      case 'Point':
        return <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'LineString':
        return <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'Polygon':
        return <Square className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  return (
    <div
      id="feature-detail-drawer"
      className="bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden shadow-xl"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-850/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {getGeometryIcon()}
              {feature.geometryType}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Tag className="w-3 h-3" /> {feature.folder}
            </span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
            {feature.name}
          </h3>
        </div>
        <button
          id="btn-close-feature-detail"
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Fechar detalhes"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto space-y-4 flex-1 text-sm">
        {/* Spatial Metrics if available */}
        {feature.metrics && (feature.metrics.lengthKm || feature.metrics.areaKm2) && (
          <div className="grid grid-cols-2 gap-2 bg-blue-50/70 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-100 dark:border-blue-900/40">
            {feature.metrics.lengthKm !== undefined && (
              <div>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Comprimento / Extensão</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {feature.metrics.lengthKm.toFixed(3)} km
                </p>
              </div>
            )}
            {feature.metrics.areaKm2 !== undefined && (
              <div>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Área Estimada</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {feature.metrics.areaKm2.toFixed(3)} km²
                </p>
                {feature.metrics.areaHectares && (
                  <p className="text-[10px] text-slate-500">
                    ({feature.metrics.areaHectares.toFixed(2)} hectares)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {feature.description && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Descrição
            </h4>
            <div
              className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words [&_h3]:font-bold [&_h3]:mb-1 [&_p]:mb-1"
              dangerouslySetInnerHTML={{ __html: feature.description }}
            />
          </div>
        )}

        {/* Attributes / Extended Data */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Atributos & Dados Estendidos ({propEntries.length})
          </h4>
          {propEntries.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {propEntries.map(([key, value]) => (
                <div key={key} className="flex px-3 py-2 justify-between items-center bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="font-medium text-slate-500 dark:text-slate-400">{key}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg">
              Nenhum atributo adicional (ExtendedData) presente neste elemento.
            </p>
          )}
        </div>

        {/* Coordinates Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Coordenadas ({feature.coordinates.length} {feature.coordinates.length === 1 ? 'ponto' : 'vértices'})
            </h4>
            <button
              id="btn-copy-coords"
              type="button"
              onClick={copyCoordinates}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto space-y-1">
            {feature.coordinates.map((c, idx) => (
              <div key={idx} className="flex justify-between border-b border-slate-100 dark:border-slate-900/60 pb-0.5 last:border-0">
                <span className="text-slate-400">#{idx + 1}</span>
                <span>Lat: {c.lat.toFixed(6)}, Lng: {c.lng.toFixed(6)} {c.alt !== undefined ? `(${c.alt}m)` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Open in external Google Maps / Earth */}
        {feature.coordinates.length > 0 && (
          <div className="pt-2">
            <a
              id="link-google-maps-external"
              href={`https://www.google.com/maps/search/?api=1&query=${feature.coordinates[0].lat},${feature.coordinates[0].lng}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Visualizar no Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
