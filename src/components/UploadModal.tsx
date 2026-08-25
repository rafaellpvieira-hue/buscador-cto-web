import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Save, Code } from 'lucide-react';
import { parseKmzOrKmlBuffer } from '../utils/kmzreader';
import { savekmzTostorage } from '../utils/kmzstorage';
import { KmzParseResult } from '../types/kmz';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoaded: (result: KmzParseResult, source: 'indexeddb') => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteFileName, setPasteFileName] = useState('dados.kml');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    const isKmz = file.name.toLowerCase().endsWith('.kmz');
    const isKml = file.name.toLowerCase().endsWith('.kml');

    if (!isKmz && !isKml) {
      setError('Formato inválido. Por favor envie um arquivo com extensão .kmz ou .kml');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const buffer = await file.arrayBuffer();
      const result = await parseKmzOrKmlBuffer(buffer, file.name);

      if (!result.success) {
        setError(result.error || 'Falha ao processar o arquivo.');
      } else {
        // Persist file into IndexedDB so it stays fixed after page reload!
        await savekmzTostorage(file.name, buffer);
        onLoaded(result, 'indexeddb');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao ler arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const processPastedKml = async () => {
    if (!pasteText.trim()) {
      setError('Cole o código KML ou XML no campo abaixo.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const encoder = new TextEncoder();
      const buffer = encoder.encode(pasteText).buffer;
      const fileName = pasteFileName.trim() || 'dados.kml';
      const result = await parseKmzOrKmlBuffer(buffer, fileName);

      if (!result.success) {
        setError(result.error || 'Falha ao interpretar o texto KML.');
      } else {
        // Persist to IndexedDB
        await savekmzTostorage(fileName, buffer);
        onLoaded(result, 'indexeddb');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar texto KML.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div id="upload-kmz-modal" className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] flex flex-col">
        <button
          id="btn-close-upload-modal"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Carregar Arquivo KMZ ou KML
            </h3>
            <p className="text-xs text-slate-500">
              O arquivo ficará <b>salvo e fixo</b> mesmo após recarregar a página.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => { setActiveTab('file'); setError(null); }}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-2 transition ${
              activeTab === 'file'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Enviar Arquivo (.kmz / .kml)</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('paste'); setError(null); }}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-2 transition ${
              activeTab === 'paste'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Colar Texto KML</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1">
          {activeTab === 'file' ? (
            /* Drop zone */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".kmz,.kml"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>

              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                {loading ? 'Processando e salvando arquivo...' : 'Arraste seu arquivo .kmz ou .kml aqui'}
              </p>
              <p className="text-xs text-slate-500">ou clique para selecionar do seu computador</p>
            </div>
          ) : (
            /* Paste KML Tab */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do arquivo:
                </label>
                <input
                  type="text"
                  value={pasteFileName}
                  onChange={(e) => setPasteFileName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  placeholder="dados.kml"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Conteúdo KML (XML):
                </label>
                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="<kml xmlns='http://www.opengis.net/kml/2.2'>&#10;  <Document>...&#10;  </Document>&#10;</kml>"
                  className="w-full p-2.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={processPastedKml}
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {loading ? 'Processando...' : 'Salvar e Carregar KML'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
            <p className="font-semibold mb-1 flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
              <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Armazenamento Persistente:
            </p>
            <p className="leading-relaxed">
              O arquivo carregado é salvo no banco de dados local do seu navegador (IndexedDB). Ele será carregado automaticamente sempre que você abrir ou atualizar (F5) esta página!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

