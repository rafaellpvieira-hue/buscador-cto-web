import React, { useState, useMemo, useEffect, useRef } from 'react';
import { KmzFeature } from '../types/kmz';
import { TelecomTab } from './TelecomTopBar';
import {
  CIDADES_OFICIAIS,
  normalizar,
  haversineDistance,
  haversineDistanceMeters,
} from '../utils/kmzReader';
import {
  Search,
  MapPin,
  Zap,
  Navigation,
  Crosshair,
  Building2,
  Phone,
  User,
  CheckCircle2,
  Copy,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Radio,
  FileText,
  Compass,
  Download,
  Share2,
  Check,
  Camera,
  Upload,
  Trash2,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface TelecomPanelProps {
  activeTab: TelecomTab;
  onSelectTab: (tab: TelecomTab) => void;
  features: KmzFeature[];
  selectedFeature: KmzFeature | null;
  onSelectFeature: (feature: KmzFeature) => void;
  userLocation: { lat: number; lng: number } | null;
  onFindGpsLocation: () => void;
  gpsLoading: boolean;
  gpsError: string | null;
}

export const TelecomPanel: React.FC<TelecomPanelProps> = ({
  activeTab,
  onSelectTab,
  features,
  selectedFeature,
  onSelectFeature,
  userLocation,
  onFindGpsLocation,
  gpsLoading,
  gpsError,
}) => {
  // ----------------------------------------------------
  // MODO 1: BUSCAR POR NOME / CIDADE
  // ----------------------------------------------------
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('Todas as Cidades/Bairro Rural');
  const [filterCategory, setFilterCategory] = useState<'all' | 'cto' | 'ce' | 'splitter'>('all');
  const [copiedSingleCoords, setCopiedSingleCoords] = useState(false);
  const [copiedCoordsId, setCopiedCoordsId] = useState<string | null>(null);

  // ----------------------------------------------------
  // MODO 2: CTO MAIS PRÓXIMA (GPS)
  // ----------------------------------------------------
  const [manualCoordsInput, setManualCoordsInput] = useState('');
  const [closestCount, setClosestCount] = useState<number>(5);
  const [closestCityFilter, setClosestCityFilter] = useState<string>('Todas as Cidades/Bairro Rural');
  const [copiedGpsCoords, setCopiedGpsCoords] = useState(false);

  // ----------------------------------------------------
  // MODO 3: SOLICITAR ATIVAÇÃO / REMOÇÃO
  // ----------------------------------------------------
  const [operationType, setOperationType] = useState<'ativacao' | 'remover_ativar'>('ativacao');
  const [protocolo, setProtocolo] = useState('');
  const [pppoe, setPppoe] = useState('');
  const [ctoInput, setCtoInput] = useState('');
  const [portaInput, setPortaInput] = useState('');
  const [onuSn, setOnuSn] = useState('');
  const [onuNovaSn, setOnuNovaSn] = useState('');
  const [cidadeInput, setCidadeInput] = useState('PARAISOPOLIS');
  const [onuImageFile, setOnuImageFile] = useState<File | null>(null);
  const [onuImageUrl, setOnuImageUrl] = useState<string | null>(null);
  const [copiedActivationText, setCopiedActivationText] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill CTO & City into Request Form when selecting a feature
  useEffect(() => {
    if (selectedFeature) {
      setCtoInput(selectedFeature.name);
      if (selectedFeature.cidadeOficial && selectedFeature.cidadeOficial !== 'OUTROS / NÃO IDENTIFICADO') {
        setCidadeInput(selectedFeature.cidadeOficial);
      }
    }
  }, [selectedFeature]);

  // Handle image upload / camera
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOnuImageFile(file);
      const url = URL.createObjectURL(file);
      setOnuImageUrl(url);
    }
  };

  const removeImage = () => {
    if (onuImageUrl) URL.revokeObjectURL(onuImageUrl);
    setOnuImageFile(null);
    setOnuImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ----------------------------------------------------
  // CIDADES OFICIAIS & FILTRAGEM
  // ----------------------------------------------------
  // Extrai todas as cidades presentes e ordena conforme CIDADES_OFICIAIS
  const { cityOptions, cityCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    
    features.forEach((f) => {
      const cidade = f.cidadeOficial || 'OUTROS / NÃO IDENTIFICADO';
      counts.set(cidade, (counts.get(cidade) || 0) + 1);
    });

    const presentes = Array.from(counts.keys());
    const ordenadas = CIDADES_OFICIAIS.filter((c) => presentes.includes(c));
    const outras = presentes.filter((c) => !CIDADES_OFICIAIS.includes(c));

    const options = ['Todas as Cidades/Bairro Rural', ...ordenadas, ...outras];
    return { cityOptions: options, cityCounts: counts };
  }, [features]);

  // Points (CTOs / Caixas de Atendimento)
  const pointFeatures = useMemo(() => {
    return features.filter((f) => f.geometryType === 'Point');
  }, [features]);

  // ----------------------------------------------------
  // MODO 1: RESULTADOS DE BUSCA
  // ----------------------------------------------------
  const searchResults = useMemo(() => {
    return features.filter((f) => {
      // Filtro de Cidade Oficial
      if (selectedCity !== 'Todas as Cidades/Bairro Rural') {
        const cidadeFeat = f.cidadeOficial || 'OUTROS / NÃO IDENTIFICADO';
        if (cidadeFeat !== selectedCity) return false;
      }

      // Filtro de Categoria (opcional para refinar CTOs)
      if (filterCategory === 'cto') {
        const isCto =
          f.name.toLowerCase().includes('cto') ||
          f.description.toLowerCase().includes('cto') ||
          f.folder.toLowerCase().includes('cto');
        if (!isCto && f.geometryType !== 'Point') return false;
      } else if (filterCategory === 'ce') {
        const isCe =
          f.name.toLowerCase().includes('ce') ||
          f.name.toLowerCase().includes('emenda') ||
          f.description.toLowerCase().includes('emenda');
        if (!isCe) return false;
      } else if (filterCategory === 'splitter') {
        const isSplitter =
          f.name.toLowerCase().includes('split') ||
          f.description.toLowerCase().includes('split');
        if (!isSplitter) return false;
      }

      // Busca por termo (nome da CTO normalizado)
      if (searchTerm.trim()) {
        const normTerm = normalizar(searchTerm);
        const normName = normalizar(f.name);
        const normDesc = normalizar(f.description);
        const normFolder = normalizar(f.folder);
        const matchName = normName.includes(normTerm);
        const matchDesc = normDesc.includes(normTerm);
        const matchFolder = normFolder.includes(normTerm);
        const matchProps = Object.values(f.properties).some((v) =>
          normalizar(String(v)).includes(normTerm)
        );
        return matchName || matchDesc || matchFolder || matchProps;
      }

      return true;
    });
  }, [features, selectedCity, searchTerm, filterCategory]);

  // ----------------------------------------------------
  // MODO 2: COORDENADAS ATIVAS (GPS OU MANUAL)
  // ----------------------------------------------------
  const activeCoordinates = useMemo<{ lat: number; lng: number } | null>(() => {
    // Check manual input first if valid
    if (manualCoordsInput.trim()) {
      const clean = manualCoordsInput.trim().replace(/[°NSEWnsew]/g, '');
      const parts = clean.split(/[,\s;]+/).map((p) => parseFloat(p.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // Assume [lat, lng]
        if (parts[0] >= -90 && parts[0] <= 90 && parts[1] >= -180 && parts[1] <= 180) {
          return { lat: parts[0], lng: parts[1] };
        }
      }
    }
    return userLocation;
  }, [manualCoordsInput, userLocation]);

  // CTOs Mais Próximas calculadas
  const closestCtos = useMemo(() => {
    if (!activeCoordinates) return [];

    let pool = pointFeatures;
    if (closestCityFilter !== 'Todas as Cidades/Bairro Rural') {
      pool = pool.filter((f) => (f.cidadeOficial || 'OUTROS / NÃO IDENTIFICADO') === closestCityFilter);
    }

    const calculated = pool.map((f) => {
      const coord = f.coordinates[0];
      const distMeters = coord ? haversineDistanceMeters(activeCoordinates, coord) : 999999999;
      return {
        feature: f,
        distMeters,
        distFormatted:
          distMeters < 1000
            ? `${Math.round(distMeters)} m`
            : `${(distMeters / 1000).toFixed(2)} km`,
      };
    });

    return calculated.sort((a, b) => a.distMeters - b.distMeters).slice(0, closestCount);
  }, [activeCoordinates, pointFeatures, closestCityFilter, closestCount]);

  // Single CTO highlight logic
  const singleResult = searchResults.length === 1 ? searchResults[0] : null;

  // Gerador de link do WhatsApp "Bater CTO"
  const getBaterCtoWhatsappLink = (nomeCto: string) => {
    const mensagem = `*Bater CTO:* ${nomeCto}\n  *Cidade:* \n  *Protocolo:* `;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
  };

  // Gerador de mensagem formatada para Solicitar Ativação / Remoção
  const activationMessageText = useMemo(() => {
    if (operationType === 'remover_ativar') {
      return `*REMOVER E ATIVAR ONU*\nProtocolo: ${protocolo || ''}\nPPPOE: ${pppoe || ''}\nCTO: ${ctoInput || ''}\nPORTA: ${portaInput || ''}\nONU NOVA s/n: ${onuNovaSn || ''}`;
    } else {
      return `*ATIVAÇÃO DE ONU*\nProtocolo: ${protocolo || ''}\nPPPOE: ${pppoe || ''}\nCTO: ${ctoInput || ''}\nPORTA: ${portaInput || ''}\nONU s/n: ${onuSn || ''}\nCidade: ${cidadeInput || ''}`;
    }
  }, [operationType, protocolo, pppoe, ctoInput, portaInput, onuNovaSn, onuSn, cidadeInput]);

  const copyToClipboard = (text: string, callback?: () => void) => {
    navigator.clipboard.writeText(text);
    if (callback) callback();
  };

  const handleCopySingleResultCoords = (feat: KmzFeature) => {
    const c = feat.coordinates[0];
    if (!c) return;
    const txt = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
    copyToClipboard(txt, () => {
      setCopiedSingleCoords(true);
      setTimeout(() => setCopiedSingleCoords(false), 2000);
    });
  };

  const handleCopyFeatureCoords = (feat: KmzFeature) => {
    const c = feat.coordinates[0];
    if (!c) return;
    const txt = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
    copyToClipboard(txt, () => {
      setCopiedCoordsId(feat.id);
      setTimeout(() => setCopiedCoordsId(null), 1800);
    });
  };

  const handleShareWhatsAppSingle = (feat: KmzFeature) => {
    const c = feat.coordinates[0];
    const mapsLink = c ? `https://www.google.com/maps?q=${c.lat},${c.lng}` : '';
    const txt = `*CTO:* ${feat.name}\n*Cidade:* ${feat.cidadeOficial || ''}\n*Localização:* ${mapsLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank');
  };

  const handleShareWhatsAppClosestTop = (item: { feature: KmzFeature; distFormatted: string }) => {
    const c = item.feature.coordinates[0];
    const mapsLink = c ? `https://www.google.com/maps?q=${c.lat},${c.lng}` : '';
    const txt = `🏆 *CTO Mais Próxima:* ${item.feature.name}\n📏 *Distância:* ${item.distFormatted}\n🏙️ *Cidade:* ${item.feature.cidadeOficial || ''}\n🗺️ *Localização:* ${mapsLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank');
  };

  const handleOpenDirectWhatsAppActivation = () => {
    const encoded = encodeURIComponent(activationMessageText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    setShareSuccess('Mensagem enviada para o WhatsApp!');
    setTimeout(() => setShareSuccess(null), 3000);
  };

  const handleShareNativeActivation = async () => {
    try {
      if (onuImageFile && navigator.canShare && navigator.canShare({ files: [onuImageFile] })) {
        await navigator.share({
          title: operationType === 'remover_ativar' ? 'Remover e Ativar ONU' : 'Ativação de ONU',
          text: activationMessageText,
          files: [onuImageFile],
        });
        setShareSuccess('Compartilhado com sucesso!');
      } else if (navigator.share) {
        await navigator.share({
          title: operationType === 'remover_ativar' ? 'Remover e Ativar ONU' : 'Ativação de ONU',
          text: activationMessageText,
        });
        setShareSuccess('Texto compartilhado!');
      } else {
        handleOpenDirectWhatsAppActivation();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleOpenDirectWhatsAppActivation();
      }
    }
  };

  return (
    <aside
      id="telecom-panel-sidebar"
      className="bg-[#0e1117] text-slate-200 border-r border-[#262730] w-full sm:w-96 md:w-[420px] h-full flex flex-col overflow-hidden shadow-2xl select-none z-10 font-sans"
    >
      {/* ======================================================== */}
      {/* MODO 1: 🔎 BUSCAR POR NOME / CIDADE */}
      {/* ======================================================== */}
      {activeTab === 'search' && (
        <div className="flex flex-col h-full">
          {/* Header Controls */}
          <div className="p-3.5 border-b border-[#262730] bg-[#161a24] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                <Search className="w-3.5 h-3.5 text-[#00a86b]" />
                Buscar por Nome / Cidade
              </span>
              <span className="text-[11px] font-bold text-[#00a86b] bg-[#00a86b]/10 border border-[#00a86b]/30 px-2.5 py-0.5 rounded-full">
                {searchResults.length} {searchResults.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>

            {/* Selectbox Cidades Oficiais */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#00a86b]" />
                Selecione a Cidade / Projeto:
              </label>
              <select
                id="select-cidade-oficial"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full text-xs py-2 px-2.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#00a86b] focus:border-[#00a86b] font-medium"
              >
                {cityOptions.map((cid) => {
                  const count = cid === 'Todas as Cidades/Bairro Rural' ? features.length : cityCounts.get(cid) || 0;
                  return (
                    <option key={cid} value={cid}>
                      {cid} {count > 0 ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Input de Busca de CTO */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Digite o nome ou número da CTO:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-busca-cto"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ex: 01, CTO 12, P05..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00a86b]/40 focus:border-[#00a86b]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-base leading-none"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>

            {/* Filter Category Chips */}
            <div className="flex gap-1.5 overflow-x-auto text-[11px] pb-0.5">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'cto', label: 'Apenas CTOs' },
                { id: 'ce', label: 'Caixas Emenda' },
                { id: 'splitter', label: 'Splitters' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilterCategory(chip.id as any)}
                  className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition ${
                    filterCategory === chip.id
                      ? 'bg-[#00a86b] text-white shadow-sm'
                      : 'bg-[#0e1117] text-slate-400 border border-[#31333f] hover:text-slate-200 hover:bg-[#262730]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Destaque quando apenas 1 resultado encontrado (Conforme Streamlit) */}
          {singleResult && singleResult.coordinates[0] && (
            <div className="p-3.5 bg-[#16271e] border-b border-[#00a86b]/40 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00a86b]" />
                  CTO Encontrada com Sucesso:
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-[#00a86b] text-white rounded">
                  {singleResult.cidadeOficial || 'OUTROS'}
                </span>
              </div>

              <p className="text-sm font-black text-white">{singleResult.name}</p>

              {/* Coordenadas Copiáveis */}
              <div className="bg-[#0e1117] p-2.5 rounded-lg border border-[#00a86b]/30 space-y-1">
                <p className="text-[10px] font-bold text-slate-400">
                  📋 Copiar coordenadas da {singleResult.name}:
                </p>
                <div className="flex items-center justify-between font-mono text-xs text-emerald-300">
                  <span>
                    {singleResult.coordinates[0].lat.toFixed(6)}, {singleResult.coordinates[0].lng.toFixed(6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopySingleResultCoords(singleResult)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#00a86b]/20 hover:bg-[#00a86b]/30 text-emerald-300 rounded text-[11px] font-bold transition border border-[#00a86b]/40"
                  >
                    {copiedSingleCoords ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSingleCoords ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleShareWhatsAppSingle(singleResult)}
                  className="py-1.5 px-2 bg-[#00a86b] hover:bg-[#008f5b] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <a
                  href={`https://www.google.com/maps?q=${singleResult.coordinates[0].lat},${singleResult.coordinates[0].lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-2 bg-[#1e222d] hover:bg-[#282d3b] text-slate-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 border border-[#31333f] transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  <span>Google Maps</span>
                </a>
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#262730] bg-[#0e1117]">
            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#00a86b]" />
                <p className="font-bold text-slate-300 text-sm mb-1">Nenhum elemento encontrado</p>
                <p className="text-slate-500">
                  Tente buscar por outro termo ou selecione <b>Todas as Cidades/Bairro Rural</b>.
                </p>
              </div>
            ) : (
              searchResults.map((feat) => {
                const isSelected = feat.id === selectedFeature?.id;
                const isPoint = feat.geometryType === 'Point';
                const coord = feat.coordinates[0];

                const distanceMeters =
                  userLocation && coord
                    ? Math.round(haversineDistance(userLocation, coord) * 1000)
                    : null;

                return (
                  <div
                    key={feat.id}
                    id={`cto-card-${feat.id}`}
                    className={`p-3 transition-all ${
                      isSelected
                        ? 'bg-[#1a2e24] border-l-4 border-[#00a86b]'
                        : 'hover:bg-[#161a24]'
                    }`}
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => onSelectFeature(feat)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                              isPoint
                                ? 'bg-[#00a86b]/20 text-[#00a86b] border border-[#00a86b]/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {isPoint ? <MapPin className="w-3.5 h-3.5" /> : <Navigation className="w-3.5 h-3.5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4
                                className={`font-bold text-xs sm:text-sm truncate leading-tight ${
                                  isSelected ? 'text-emerald-300' : 'text-slate-100'
                                }`}
                              >
                                {feat.name}
                              </h4>
                              {feat.cidadeOficial && (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                                  {feat.cidadeOficial}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-400 truncate mt-1">
                              {feat.folder || 'Sem Pasta'}
                              {coord ? ` • ${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` : ''}
                            </p>
                          </div>
                        </div>

                        {distanceMeters !== null && (
                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs font-bold text-[#00a86b] bg-[#00a86b]/10 px-1.5 py-0.5 rounded border border-[#00a86b]/20">
                              {distanceMeters < 1000 ? `${distanceMeters}m` : `${(distanceMeters / 1000).toFixed(2)}km`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Buttons per CTO */}
                    <div className="mt-2.5 pt-2 border-t border-[#262730]/60 flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onSelectFeature(feat)}
                        className="px-2 py-1 bg-[#1e222d] hover:bg-[#282d3b] text-slate-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 border border-[#31333f]"
                        title="Ver no mapa"
                      >
                        <MapPin className="w-3 h-3 text-[#00a86b]" />
                        <span>Ver Mapa</span>
                      </button>

                      {coord && (
                        <>
                          <a
                            href={`https://www.google.com/maps?q=${coord.lat},${coord.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-[#1e222d] hover:bg-[#282d3b] text-slate-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 border border-[#31333f]"
                            title="Abrir no Google Maps"
                          >
                            <ExternalLink className="w-3 h-3 text-blue-400" />
                            <span>GPS</span>
                          </a>

                          <a
                            href={getBaterCtoWhatsappLink(feat.name)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-[#00a86b]/15 hover:bg-[#00a86b]/25 text-emerald-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 border border-[#00a86b]/30"
                            title="Bater CTO no WhatsApp"
                          >
                            <MessageSquare className="w-3 h-3 text-[#00a86b]" />
                            <span>Bater CTO</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyFeatureCoords(feat)}
                            className="px-2 py-1 bg-[#1e222d] hover:bg-[#282d3b] text-slate-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 border border-[#31333f]"
                            title="Copiar Coordenadas"
                          >
                            {copiedCoordsId === feat.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{copiedCoordsId === feat.id ? 'Copiado!' : 'Coord'}</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectFeature(feat);
                          onSelectTab('request');
                        }}
                        className="ml-auto px-2.5 py-1 bg-[#00a86b] hover:bg-[#008f5b] text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-sm"
                        title="Criar ordem para esta CTO"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Solicitar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODO 2: 📍 CTO MAIS PRÓXIMA (MINHA LOCALIZAÇÃO) */}
      {/* ======================================================== */}
      {activeTab === 'closest-cto' && (
        <div className="flex flex-col h-full">
          {/* Top GPS Trigger Header */}
          <div className="p-3.5 border-b border-[#262730] bg-[#161a24] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                <Crosshair className="w-3.5 h-3.5 text-[#00a86b]" />
                CTO Mais Próxima (Minha Localização)
              </span>
              <button
                id="btn-trigger-gps"
                type="button"
                onClick={onFindGpsLocation}
                disabled={gpsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00a86b] hover:bg-[#008f5b] text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                <Crosshair className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>{gpsLoading ? 'Localizando...' : '📡 Obter GPS'}</span>
              </button>
            </div>

            {/* GPS Status & Readout */}
            {userLocation ? (
              <div className="p-2.5 rounded-lg bg-[#1a2e24] border border-[#00a86b]/40 text-xs text-emerald-300 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00a86b] animate-ping shrink-0"></span>
                  <div>
                    <p className="font-bold text-white text-[11px]">Sua localização atual:</p>
                    <p className="font-mono text-[11px] text-emerald-300">
                      {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const txt = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
                    copyToClipboard(txt, () => {
                      setCopiedGpsCoords(true);
                      setTimeout(() => setCopiedGpsCoords(false), 2000);
                    });
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-200 bg-[#00a86b]/20 hover:bg-[#00a86b]/30 px-2 py-1 rounded border border-[#00a86b]/40 transition"
                >
                  {copiedGpsCoords ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedGpsCoords ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#1a1c24] border border-[#31333f] text-xs text-slate-300 space-y-1">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#00a86b]" />
                  Descubra a CTO mais perto de você
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Clique em <b>"📡 Obter GPS"</b> ou cole suas coordenadas abaixo.
                </p>
              </div>
            )}

            {gpsError && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span className="text-[11px]">{gpsError}</span>
              </div>
            )}

            {/* Input Manual de Coordenadas */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Cole aqui suas coordenadas (ex: -22.410920, -45.793186):
              </label>
              <input
                id="input-manual-coords"
                type="text"
                value={manualCoordsInput}
                onChange={(e) => setManualCoordsInput(e.target.value)}
                placeholder="-22.410920, -45.793186"
                className="w-full px-2.5 py-1.5 text-xs bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
              />
            </div>

            {/* Filtro Opcional de Cidade e Slider Quantidade */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                  Filtrar Cidade:
                </label>
                <select
                  value={closestCityFilter}
                  onChange={(e) => setClosestCityFilter(e.target.value)}
                  className="w-full text-[11px] py-1.5 px-2 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                >
                  {cityOptions.map((cid) => (
                    <option key={cid} value={cid}>
                      {cid}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                  Exibir: {closestCount} CTOs
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={closestCount}
                  onChange={(e) => setClosestCount(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-[#262730] rounded-lg appearance-none cursor-pointer accent-[#00a86b]"
                />
              </div>
            </div>
          </div>

          {/* Destaque da CTO mais próxima (Top 1) */}
          {closestCtos.length > 0 && closestCtos[0] && (
            <div className="p-3.5 bg-[#16271e] border-b border-[#00a86b]/40 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🏆</span>
                <p className="text-xs font-extrabold text-white">
                  CTO mais próxima:{' '}
                  <span className="text-emerald-300 font-black">{closestCtos[0].feature.name}</span> a apenas{' '}
                  <span className="text-[#00a86b] font-black">{closestCtos[0].distFormatted}</span> de distância!
                </p>
              </div>

              {closestCtos[0].feature.coordinates[0] && (
                <div className="bg-[#0e1117] p-2.5 rounded-lg border border-[#00a86b]/30 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400">
                    📋 Copiar coordenadas da CTO mais próxima ({closestCtos[0].feature.name}):
                  </p>
                  <div className="flex items-center justify-between font-mono text-xs text-emerald-300">
                    <span>
                      {closestCtos[0].feature.coordinates[0].lat.toFixed(6)},{' '}
                      {closestCtos[0].feature.coordinates[0].lng.toFixed(6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySingleResultCoords(closestCtos[0].feature)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-[#00a86b]/20 hover:bg-[#00a86b]/30 text-emerald-300 rounded text-[11px] font-bold transition border border-[#00a86b]/40"
                    >
                      {copiedSingleCoords ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSingleCoords ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleShareWhatsAppClosestTop(closestCtos[0])}
                  className="py-1.5 px-2 bg-[#00a86b] hover:bg-[#008f5b] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <a
                  href={getBaterCtoWhatsappLink(closestCtos[0].feature.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-2 bg-[#1e222d] hover:bg-[#282d3b] text-slate-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 border border-[#31333f] transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bater CTO</span>
                </a>
              </div>
            </div>
          )}

          {/* List of Closest CTOs */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#262730] bg-[#0e1117]">
            {!activeCoordinates ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-3">
                <Crosshair className="w-12 h-12 mx-auto text-[#00a86b] opacity-30 animate-pulse" />
                <div>
                  <p className="font-bold text-slate-200 text-sm mb-1">Localização Aguardando Definição</p>
                  <p className="text-slate-500 max-w-xs mx-auto">
                    Clique em <b>"📡 Obter GPS"</b> ou cole suas coordenadas no campo acima para listar as CTOs ordenadas pela distância.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onFindGpsLocation}
                  className="px-4 py-2 bg-[#00a86b] hover:bg-[#008f5b] text-white font-bold rounded-lg text-xs shadow-md transition"
                >
                  Ativar Geolocalização Agora
                </button>
              </div>
            ) : closestCtos.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <p>Nenhuma CTO encontrada para os filtros selecionados.</p>
              </div>
            ) : (
              closestCtos.map((item, index) => {
                const feat = item.feature;
                const isSelected = feat.id === selectedFeature?.id;
                const isFirst = index === 0;
                const coord = feat.coordinates[0];

                return (
                  <div
                    key={feat.id}
                    id={`closest-cto-item-${feat.id}`}
                    className={`p-3 transition ${
                      isSelected
                        ? 'bg-[#1a2e24] border-l-4 border-[#00a86b]'
                        : 'hover:bg-[#161a24]'
                    }`}
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => onSelectFeature(feat)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              isFirst
                                ? 'bg-[#00a86b] text-white shadow-md'
                                : 'bg-[#262730] text-slate-300 border border-[#31333f]'
                            }`}
                          >
                            {index + 1}º
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                                {feat.name}
                              </h4>
                              {feat.cidadeOficial && (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                                  {feat.cidadeOficial}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {feat.folder || 'Sem Pasta'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-mono font-extrabold text-sm text-[#00a86b]">
                            {item.distFormatted}
                          </p>
                          <p className="text-[10px] text-slate-500">em linha reta</p>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-2.5 pt-2 border-t border-[#262730]/60 flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onSelectFeature(feat)}
                        className="px-2 py-1 bg-[#1e222d] hover:bg-[#282d3b] text-slate-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 border border-[#31333f]"
                      >
                        <MapPin className="w-3 h-3 text-[#00a86b]" />
                        <span>Ver Mapa</span>
                      </button>

                      {coord && (
                        <>
                          <a
                            href={
                              userLocation
                                ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${coord.lat},${coord.lng}`
                                : `https://www.google.com/maps?q=${coord.lat},${coord.lng}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-[#1e222d] hover:bg-[#282d3b] text-slate-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 border border-[#31333f]"
                          >
                            <ExternalLink className="w-3 h-3 text-blue-400" />
                            <span>Rota</span>
                          </a>

                          <a
                            href={getBaterCtoWhatsappLink(feat.name)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-[#00a86b]/15 hover:bg-[#00a86b]/25 text-emerald-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 border border-[#00a86b]/30"
                          >
                            <MessageSquare className="w-3 h-3 text-[#00a86b]" />
                            <span>Bater CTO</span>
                          </a>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectFeature(feat);
                          onSelectTab('request');
                        }}
                        className="ml-auto px-2.5 py-1 bg-[#00a86b] hover:bg-[#008f5b] text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-sm"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Solicitar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODO 3: ⚡ SOLICITAR ATIVAÇÃO / REMOÇÃO */}
      {/* ======================================================== */}
      {activeTab === 'request' && (
        <div className="flex flex-col h-full overflow-y-auto p-4 space-y-3.5 text-xs bg-[#0e1117]">
          {/* Header */}
          <div className="border-b border-[#262730] pb-2.5">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#00a86b]" />
              Solicitar ativação/remoção
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Escolha a operação, preencha os dados e tire a foto da ONU para enviar ao suporte.
            </p>
          </div>

          {/* Operação Radio */}
          <div>
            <label className="block font-bold text-slate-200 mb-1.5 uppercase tracking-wide text-[11px]">
              Operação:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOperationType('ativacao')}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                  operationType === 'ativacao'
                    ? 'bg-[#00a86b] text-white border-[#00a86b] shadow-sm'
                    : 'bg-[#161a24] text-slate-300 border-[#31333f] hover:bg-[#262730]'
                }`}
              >
                <span>Ativação de ONU</span>
              </button>

              <button
                type="button"
                onClick={() => setOperationType('remover_ativar')}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                  operationType === 'remover_ativar'
                    ? 'bg-[#00a86b] text-white border-[#00a86b] shadow-sm'
                    : 'bg-[#161a24] text-slate-300 border-[#31333f] hover:bg-[#262730]'
                }`}
              >
                <span>Remover e Ativar ONU</span>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-2.5 bg-[#161a24] p-3 rounded-xl border border-[#31333f]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Protocolo:</label>
                <input
                  type="text"
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value)}
                  placeholder="Ex: 2026081501"
                  className="w-full px-2.5 py-1.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">PPPOE:</label>
                <input
                  type="text"
                  value={pppoe}
                  onChange={(e) => setPppoe(e.target.value)}
                  placeholder="Ex: cliente_fibra123"
                  className="w-full px-2.5 py-1.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">CTO:</label>
                <input
                  type="text"
                  value={ctoInput}
                  onChange={(e) => setCtoInput(e.target.value)}
                  placeholder="Ex: CTO 122"
                  className="w-full px-2.5 py-1.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">PORTA:</label>
                <input
                  type="text"
                  value={portaInput}
                  onChange={(e) => setPortaInput(e.target.value)}
                  placeholder="Ex: 04"
                  className="w-full px-2.5 py-1.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                />
              </div>
            </div>

            {/* Condicional conforme operação */}
            {operationType === 'remover_ativar' ? (
              <div>
                <label className="block font-semibold text-slate-300 mb-1">ONU NOVA s/n:</label>
                <input
                  type="text"
                  value={onuNovaSn}
                  onChange={(e) => setOnuNovaSn(e.target.value)}
                  placeholder="Ex: ALCLB1234567"
                  className="w-full px-2.5 py-1.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">ONU s/n:</label>
                  <input
                    type="text"
                    value={onuSn}
                    onChange={(e) => setOnuSn(e.target.value)}
                    placeholder="Ex: ALCLB1234567"
                    className="w-full px-2.5 py-1.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Cidade:</label>
                  <select
                    value={cidadeInput}
                    onChange={(e) => setCidadeInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#0e1117] border border-[#31333f] rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#00a86b]"
                  >
                    {CIDADES_OFICIAIS.map((cid) => (
                      <option key={cid} value={cid}>
                        {cid}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Foto da ONU / Etiqueta S/N */}
          <div className="space-y-2 bg-[#161a24] p-3 rounded-xl border border-[#31333f]">
            <label className="block font-bold text-slate-200 text-[11px] flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#00a86b]" />
              Foto da ONU / Etiqueta S/N:
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
              id="camera-onu-upload"
            />

            {!onuImageUrl ? (
              <label
                htmlFor="camera-onu-upload"
                className="w-full py-4 border-2 border-dashed border-[#31333f] hover:border-[#00a86b] rounded-xl flex flex-col items-center justify-center cursor-pointer bg-[#0e1117] hover:bg-[#12151c] transition"
              >
                <Camera className="w-6 h-6 text-[#00a86b] mb-1" />
                <span className="font-bold text-slate-300 text-xs">Tirar Foto da Câmera ou Galeria</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Clique para anexar a imagem da ONU</span>
              </label>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border border-[#31333f] bg-black max-h-48 flex items-center justify-center">
                  <img
                    src={onuImageUrl}
                    alt="Foto da ONU"
                    className="max-h-48 object-contain"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full shadow-md transition"
                    title="Remover Imagem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Foto anexada ({onuImageFile?.name})
                </p>
              </div>
            )}
          </div>

          {/* Visualização da Mensagem Formatada */}
          <div className="bg-[#0e1117] p-3 rounded-xl border border-[#31333f] space-y-1.5 font-mono text-[11px]">
            <p className="text-[10px] font-sans font-bold text-slate-400">Texto que será enviado ao suporte:</p>
            <pre className="text-emerald-300 whitespace-pre-wrap leading-relaxed">
              {activationMessageText}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 space-y-2">
            <button
              id="btn-whatsapp-open-direct"
              type="button"
              onClick={handleOpenDirectWhatsAppActivation}
              className="w-full py-3 px-4 bg-[#00a86b] hover:bg-[#008f5b] text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>🟢 1. Abrir Direto no WhatsApp</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleShareNativeActivation}
                className="py-2.5 px-3 bg-[#1e222d] hover:bg-[#282d3b] text-slate-200 font-semibold rounded-xl text-xs border border-[#31333f] transition flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>📲 2. Compartilhar Imagem + Texto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  copyToClipboard(activationMessageText, () => {
                    setCopiedActivationText(true);
                    setTimeout(() => setCopiedActivationText(false), 2000);
                  });
                }}
                className="py-2.5 px-3 bg-[#1e222d] hover:bg-[#282d3b] text-slate-200 font-semibold rounded-xl text-xs border border-[#31333f] transition flex items-center justify-center gap-1.5"
              >
                {copiedActivationText ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copiedActivationText ? 'Copiado!' : '📋 Copiar Texto'}</span>
              </button>
            </div>
          </div>

          {shareSuccess && (
            <div className="p-2.5 rounded-lg bg-[#1a2e24] border border-[#00a86b]/40 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-[#00a86b]" />
              <span>{shareSuccess}</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
