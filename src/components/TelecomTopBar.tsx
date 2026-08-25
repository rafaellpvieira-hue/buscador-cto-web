import React from 'react';
import { Search, MapPin, Zap } from 'lucide-react';

export type TelecomTab = 'search' | 'closest-cto' | 'request';

interface TelecomTopBarProps {
  activeTab: TelecomTab;
  onSelectTab: (tab: TelecomTab) => void;
  closestCtoDistance?: number | null;
  closestCtoName?: string | null;
  selectedCtoName?: string | null;
}

export const TelecomTopBar: React.FC<TelecomTopBarProps> = ({
  activeTab,
  onSelectTab,
  closestCtoDistance,
  closestCtoName,
  selectedCtoName,
}) => {
  return (
    <div
      id="telecom-tools-bar"
      className="bg-[#0e1117] text-slate-200 border-b border-[#262730] px-3 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto select-none shadow-md"
    >
      {/* 1. Buscar por Nome / Cidade */}
      <button
        id="btn-tab-search-city"
        type="button"
        onClick={() => onSelectTab('search')}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
          activeTab === 'search'
            ? 'bg-[#00a86b] text-white shadow-sm ring-1 ring-[#00a86b]/40 font-bold'
            : 'text-slate-300 hover:text-white bg-[#1a1c24] hover:bg-[#262730] border border-[#31333f]'
        }`}
      >
        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Buscar por Nome / Cidade</span>
      </button>

      {/* 2. CTO Mais Próxima (GPS) */}
      <button
        id="btn-tab-closest-cto"
        type="button"
        onClick={() => onSelectTab('closest-cto')}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
          activeTab === 'closest-cto'
            ? 'bg-[#00a86b] text-white shadow-sm ring-1 ring-[#00a86b]/40 font-bold'
            : 'text-slate-300 hover:text-white bg-[#1a1c24] hover:bg-[#262730] border border-[#31333f]'
        }`}
      >
        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>CTO Mais Próxima (GPS)</span>
        {closestCtoDistance !== undefined && closestCtoDistance !== null && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-black/40 text-[10px] sm:text-xs font-mono text-emerald-200 font-bold">
            {closestCtoDistance < 1
              ? `${Math.round(closestCtoDistance * 1000)}m`
              : `${closestCtoDistance.toFixed(2)}km`}
          </span>
        )}
      </button>

      {/* 3. Solicitar Ativação / Remoção */}
      <button
        id="btn-tab-request-activation"
        type="button"
        onClick={() => onSelectTab('request')}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
          activeTab === 'request'
            ? 'bg-[#00a86b] text-white shadow-sm ring-1 ring-[#00a86b]/40 font-bold'
            : 'text-slate-300 hover:text-white bg-[#1a1c24] hover:bg-[#262730] border border-[#31333f]'
        }`}
      >
        <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Solicitar Ativação / Remoção</span>
        {selectedCtoName && (
          <span className="hidden md:inline-block max-w-[120px] truncate text-[10px] text-emerald-200 font-normal bg-black/30 px-1.5 py-0.5 rounded">
            {selectedCtoName}
          </span>
        )}
      </button>
    </div>
  );
};
