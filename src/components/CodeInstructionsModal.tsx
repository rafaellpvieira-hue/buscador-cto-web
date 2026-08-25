import React, { useState } from 'react';
import { X, Code2, Copy, Check, Terminal, FolderTree } from 'lucide-react';

interface CodeInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeInstructionsModal: React.FC<CodeInstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const reactSnippet = `// Exemplo de leitura automática de public/dados.kmz em React/Vite:
import { useEffect, useState } from 'react';
import JSZip from 'jszip';

export function usekmzreader(url = '/dados.kmz') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadKmz() {
      try {
        setLoading(true);
        // 1. Faz o fetch do arquivo salvo na pasta /public
        const response = await fetch(url);
        if (!response.ok) throw new Error(\`Erro HTTP \${response.status}\`);
        
        // 2. Obtém o buffer binário
        const arrayBuffer = await response.arrayBuffer();
        
        // 3. Descompacta o arquivo ZIP (KMZ) usando JSZip
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // 4. Localiza o arquivo KML principal (doc.kml ou *.kml)
        const kmlFile = Object.keys(zip.files).find(
          name => name.toLowerCase().endsWith('.kml')
        );
        if (!kmlFile) throw new Error('doc.kml não encontrado no KMZ');
        
        // 5. Extrai o texto KML
        const kmlText = await zip.files[kmlFile].async('text');
        
        // 6. Faz o parse do XML KML no navegador
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
        
        setData({ xmlDoc, kmlText });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadKmz();
  }, [url]);

  return { data, loading, error };
}`;

  return (
    <div id="code-instructions-modal" className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] flex flex-col">
        <button
          id="btn-close-code-modal"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Como Funciona a Leitura de dados.kmz
            </h3>
            <p className="text-xs text-slate-500">
              Arquitetura de carregamento automático e extração no React
            </p>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* File Structure explanation */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-500" />
              1. Localização do Arquivo no Projeto
            </h4>
            <p className="text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              No Vite e React, qualquer arquivo colocado na pasta <code>/public</code> é servido na raiz do domínio. Portanto, <code>/public/dados.kmz</code> é acessível diretamente pela URL <code>/dados.kmz</code>.
            </p>
            <div className="bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-[11px]">
              projeto/<br />
              ├── public/<br />
              │&nbsp;&nbsp;&nbsp;└── <b>dados.kmz</b>&nbsp;&nbsp;<span className="text-emerald-400">&larr; Salve seu arquivo aqui</span><br />
              ├── src/<br />
              │&nbsp;&nbsp;&nbsp;├── App.tsx<br />
              │&nbsp;&nbsp;&nbsp;└── utils/kmzReader.ts<br />
              └── package.json
            </div>
          </div>

          {/* Flow steps */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500" />
              2. Fluxo de Execução Automática ao Iniciar
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300">
              <li><b>App Mount:</b> O React executa o <code>useEffect</code> inicial que chama <code>loadKmzFromPublic('/dados.kmz')</code>.</li>
              <li><b>Fetch Binário:</b> O navegador faz uma requisição HTTP GET para <code>/dados.kmz</code> e obtém o <code>ArrayBuffer</code>.</li>
              <li><b>Descompactação JSZip:</b> Como o KMZ é um arquivo ZIP compactado contendo <code>doc.kml</code> e imagens, a biblioteca <code>jszip</code> extrai os dados na memória do cliente.</li>
              <li><b>Parser XML & Geometrias:</b> O <code>DOMParser</code> processa todas as tags KML (Placemarks, Polygons, LineStrings, Points, ExtendedData).</li>
              <li><b>Renderização no Mapa:</b> O Leaflet plota instantaneamente as camadas com cores, ícones e popups.</li>
            </ol>
          </div>

          {/* Copyable Code Snippet */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Código Exemplo de Leitura em TypeScript/React
              </span>
              <button
                type="button"
                onClick={() => copySnippet(reactSnippet, 'react')}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                {copied === 'react' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'react' ? 'Copiado!' : 'Copiar Código'}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed">
              {reactSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
