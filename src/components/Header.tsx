import React, { useState } from 'react';
import { KmzMetadata } from '../types/kmz';
import {
  Map,
  Table as TableIcon,
  Columns,
  RefreshCw,
  Upload,
  Download,
  Code2,
  Database,
  FileCode,
  Table2,
  FileText,
  Trash2,
  Radio,
} from 'lucide-react';

interface HeaderProps {
  metadata: KmzMetadata | null;
  loading: boolean;
  fileSource: 'indexeddb' | 'public' | 'none';
  onReload: () => void;
  onOpenUpload: () => void;
  onOpenCodeModal: () => void;
  onClearStoredKmz: () => void;
  activeView: 'split' | 'map' | 'table';
  setActiveView: (view: 'split' | 'map' | 'table') => void;
  onExportGeoJson: () => void;
  onExportKml: () => void;
  onExportCsv: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  metadata,
  loading,
  fileSource,
  onReload,
  onOpenUpload,
  onOpenCodeModal,
  onClearStoredKmz,
  activeView,
  setActiveView,
  onExportGeoJson,
  onExportKml,
  onExportCsv,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="bg-[#0e1117] text-white border-b border-[#262730] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
      {/* Brand & File Status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#00a86b] flex items-center justify-center text-white shadow-md shadow-[#00a86b]/20 shrink-0">
          <Radio className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-extrabold text-white text-sm sm:text-base tracking-tight flex items-center gap-1.5">
              <span>Busca CTO SBS</span>
            </h1>
            {metadata && metadata.fileName && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#00a86b]/15 text-emerald-300 border border-[#00a86b]/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a86b] animate-pulse"></span>
                <span className="font-semibold truncate max-w-[140px]">{metadata.fileName}</span>
                <span className="opacity-75 text-[10px]">({metadata.fileSizeFormatted})</span>
              </span>
            )}

            {fileSource === 'indexeddb' && (
              <span
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/70 text-blue-300 border border-blue-800"
                title="Salvo localmente no seu navegador e não sai após atualizar a página"
              >
                <Database className="w-3 h-3 text-blue-400" />
                KMZ Fixo
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
            {fileSource === 'indexeddb' ? (
              <span className="flex items-center gap-1">
                <span>Arquivo persistido no</span>
                <b className="text-emerald-400">IndexedDB</b>
                <span>(permanece ao atualizar a página)</span>
              </span>
            ) : fileSource === 'public' ? (
              <span>
                Leitura de:{' '}
                <code className="text-emerald-400 font-mono font-semibold">
                  public/dados.kmz
                </code>
              </span>
            ) : (
              <span>Nenhum arquivo ativo. Carregue seu KMZ para fixar.</span>
            )}
          </p>
        </div>
      </div>

      {/* Center View Switcher */}
      <div className="flex items-center bg-[#161a24] p-1 rounded-lg border border-[#31333f] text-xs">
        <button
          id="btn-view-split"
          type="button"
          onClick={() => setActiveView('split')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
            activeView === 'split'
              ? 'bg-[#00a86b] text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Visualização com Painel Lateral + Mapa"
        >
          <Columns className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Painel + Mapa</span>
        </button>

        <button
          id="btn-view-map"
          type="button"
          onClick={() => setActiveView('map')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
            activeView === 'map'
              ? 'bg-[#00a86b] text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Apenas Mapa"
        >
          <Map className="w-3.5 h-3.5" />
          <span>Apenas Mapa</span>
        </button>

        <button
          id="btn-view-table"
          type="button"
          onClick={() => setActiveView('table')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
            activeView === 'table'
              ? 'bg-[#00a86b] text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Tabela de Dados"
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Tabela Geral</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Upload Other KMZ */}
        <button
          id="btn-open-upload-modal"
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00a86b] hover:bg-[#008f5b] text-white rounded-lg text-xs font-bold shadow-sm transition"
          title="Carregar e fixar outro arquivo KMZ/KML"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload KMZ</span>
        </button>

        {/* Clear stored KMZ */}
        {fileSource === 'indexeddb' && (
          <button
            id="btn-clear-stored-kmz"
            type="button"
            onClick={onClearStoredKmz}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a1c24] hover:bg-red-950/60 text-slate-300 hover:text-red-400 rounded-lg text-xs font-semibold border border-[#31333f] transition"
            title="Remover arquivo KMZ salvo do navegador"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Limpar</span>
          </button>
        )}

        {/* Reload button */}
        <button
          id="btn-reload-dados-kmz"
          type="button"
          onClick={onReload}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a1c24] hover:bg-[#262730] text-slate-300 rounded-lg text-xs font-semibold border border-[#31333f] transition disabled:opacity-50"
          title="Recarregar dados"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#00a86b] ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden lg:inline">Recarregar</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            id="btn-export-dropdown"
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a1c24] hover:bg-[#262730] text-slate-300 rounded-lg text-xs font-semibold border border-[#31333f] transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>

          {showExportMenu && (
            <div
              className="absolute right-0 mt-2 w-48 bg-[#161a24] rounded-xl shadow-2xl border border-[#31333f] py-1.5 z-50 text-xs font-medium"
              onClick={() => setShowExportMenu(false)}
            >
              <button
                type="button"
                onClick={onExportGeoJson}
                className="w-full text-left px-3.5 py-2 hover:bg-[#262730] flex items-center gap-2 text-slate-200"
              >
                <FileCode className="w-4 h-4 text-[#00a86b]" />
                <span>Exportar GeoJSON</span>
              </button>
              <button
                type="button"
                onClick={onExportKml}
                className="w-full text-left px-3.5 py-2 hover:bg-[#262730] flex items-center gap-2 text-slate-200"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Exportar KML</span>
              </button>
              <button
                type="button"
                onClick={onExportCsv}
                className="w-full text-left px-3.5 py-2 hover:bg-[#262730] flex items-center gap-2 text-slate-200"
              >
                <Table2 className="w-4 h-4 text-cyan-400" />
                <span>Exportar CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
