import { get, set, del } from 'idb-keyval';
import { parseKmzOrKmlBuffer, loadKmzFromPublic } from './kmzReader';
import { KmzParseResult } from '../types/kmz';

const KMZ_STORAGE_KEY = 'visualizador_kmz_uploaded_file';

export interface StoredKmzFile {
  fileName: string;
  buffer: ArrayBuffer;
  savedAt: string;
  fileSizeBytes: number;
}

/**
 * Saves a KMZ or KML ArrayBuffer to IndexedDB so it persists across page refreshes
 */
export async function saveKmzToStorage(fileName: string, buffer: ArrayBuffer): Promise<void> {
  const data: StoredKmzFile = {
    fileName,
    buffer,
    savedAt: new Date().toISOString(),
    fileSizeBytes: buffer.byteLength,
  };
  await set(KMZ_STORAGE_KEY, data);
}

/**
 * Retrieves the stored KMZ from IndexedDB if it exists
 */
export async function getStoredKmz(): Promise<StoredKmzFile | null> {
  try {
    const data = await get<StoredKmzFile>(KMZ_STORAGE_KEY);
    return data || null;
  } catch (err) {
    console.error('Erro ao acessar IndexedDB:', err);
    return null;
  }
}

/**
 * Clears the stored KMZ from IndexedDB
 */
export async function clearStoredKmz(): Promise<void> {
  await del(KMZ_STORAGE_KEY);
}

/**
 * Main loader:
 * 1. Checks IndexedDB first (user uploaded file that persists across reloads)
 * 2. If not found, tries to fetch /dados.kmz from public folder
 * 3. Returns the result with an indicator of where it came from
 */
export async function loadPersistentKmz(): Promise<{
  result: KmzParseResult;
  source: 'indexeddb' | 'public' | 'none';
  savedAt?: string;
}> {
  // 1. Check IndexedDB
  try {
    const stored = await getStoredKmz();
    if (stored && stored.buffer && stored.buffer.byteLength > 0) {
      const parsed = await parseKmzOrKmlBuffer(stored.buffer, stored.fileName);
      if (parsed.success) {
        return {
          result: parsed,
          source: 'indexeddb',
          savedAt: stored.savedAt,
        };
      }
    }
  } catch (err) {
    console.warn('Falha ao ler KMZ do IndexedDB:', err);
  }

  // 2. Check public/dados.kmz
  try {
    const publicResult = await loadKmzFromPublic('/dados.kmz');
    if (publicResult.success) {
      return {
        result: publicResult,
        source: 'public',
      };
    }
  } catch (err) {
    console.warn('Falha ao ler /dados.kmz da pasta public:', err);
  }

  // 3. No file available
  return {
    result: {
      success: false,
      features: [],
      metadata: {
        fileName: '',
        fileSizeFormatted: '0 B',
        fileSizeBytes: 0,
        documentName: 'Nenhum arquivo carregado',
        documentDescription: '',
        totalFeatures: 0,
        pointsCount: 0,
        linesCount: 0,
        polygonsCount: 0,
        folders: [],
        bounds: null,
        loadedAt: new Date(),
        kmlFileName: '',
        embeddedFilesCount: 0,
      },
      error: 'Nenhum arquivo KMZ salvo ou encontrado. Faça o upload do seu arquivo .kmz para visualizá-lo.',
    },
    source: 'none',
  };
}
