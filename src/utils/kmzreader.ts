import JSZip from 'jszip';
import { kml as toGeoJsonKml } from '@tmcw/togeojson';
import { Coordinate, GeometryType, KmzFeature, KmzMetadata, KmzParseResult } from '../types/kmz';

export const CIDADES_OFICIAIS: string[] = [
  'PARAISOPOLIS',
  'DISTRITO DOS COSTAS',
  'CONCEICAO DOS OUROS',
  'CACHOEIRA DE MINAS',
  'SAO BENTO DO SAPUCAI',
  'SAPUCAI MIRIM',
  'POUSO ALEGRE',
  'RIBEIRAOZINHO',
  'PONTE DE FERRO',
  'BAU DO CENTRO',
  'OSÓRIO',
  'CORREGO DA FOICE',
  'BELA VISTA',
  'RIBEIRÃO',
  'INACIOS',
  'COQUEIROS',
  'CONC. DOS OUROS',
];

/**
 * Remove acentos, caracteres especiais e converte para minúsculas
 */
export function normalizar(texto: string | null | undefined): string {
  if (!texto) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Identifica a cidade oficial através da hierarquia de pastas (stack)
 */
export function identificarCidadeOficial(stack: string[]): string {
  for (const folderName of stack) {
    if (!folderName) continue;
    const normFolder = normalizar(folderName);
    for (const cidadeOficial of CIDADES_OFICIAIS) {
      const normOficial = normalizar(cidadeOficial);
      if (
        normOficial === normFolder ||
        normFolder.includes(normOficial) ||
        normOficial.includes(normFolder)
      ) {
        return cidadeOficial;
      }
    }
  }
  return 'OUTROS / NÃO IDENTIFICADO';
}

// Helper to convert KML color (AABBGGRR in hex) to CSS hex/rgba
export function kmlColorToCss(kmlColor?: string): { hex: string; rgba: string; opacity: number } | null {
  if (!kmlColor || typeof kmlColor !== 'string') return null;
  const clean = kmlColor.trim().replace(/^#/, '');
  if (clean.length === 8) {
    const a = parseInt(clean.substring(0, 2), 16) / 255;
    const b = parseInt(clean.substring(2, 4), 16);
    const g = parseInt(clean.substring(4, 6), 16);
    const r = parseInt(clean.substring(6, 8), 16);
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    return {
      hex,
      rgba: `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`,
      opacity: a,
    };
  } else if (clean.length === 6) {
    return {
      hex: `#${clean}`,
      rgba: `rgba(${parseInt(clean.substring(0, 2), 16)}, ${parseInt(clean.substring(2, 4), 16)}, ${parseInt(clean.substring(4, 6), 16)}, 1)`,
      opacity: 1,
    };
  }
  return null;
}

// Calculate Haversine distance in meters or km between two coordinates
export function haversineDistance(c1: Coordinate, c2: Coordinate): number {
  const R = 6371; // Earth radius in km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function haversineDistanceMeters(c1: Coordinate, c2: Coordinate): number {
  return haversineDistance(c1, c2) * 1000;
}

// Calculate line length in km
export function calculateLineLength(coords: Coordinate[]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistance(coords[i], coords[i + 1]);
  }
  return total;
}

// Calculate approximate spherical polygon area in km2
export function calculatePolygonArea(coords: Coordinate[]): number {
  if (coords.length < 3) return 0;
  const R = 6378137; // Earth radius in meters
  let totalArea = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    const lat1 = (p1.lat * Math.PI) / 180;
    const lat2 = (p2.lat * Math.PI) / 180;
    totalArea += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  totalArea = (Math.abs(totalArea) * R * R) / 2;
  return totalArea / 1000000; // in km²
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to parse coordinate string "lng,lat,alt lng,lat,alt ..."
export function parseKmlCoordinates(coordStr: string): Coordinate[] {
  const clean = coordStr.trim();
  if (!clean) return [];
  const coords: Coordinate[] = [];
  const tuples = clean.split(/\s+/);

  for (const tuple of tuples) {
    const parts = tuple.split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const alt = parts.length > 2 ? parseFloat(parts[2]) : undefined;
      if (!isNaN(lat) && !isNaN(lng)) {
        coords.push({ lat, lng, alt: isNaN(alt || 0) ? undefined : alt });
      }
    }
  }
  return coords;
}

/**
 * Loads a KMZ or KML from a public URL (e.g. '/dados.kmz')
 */
export async function loadKmzFromPublic(url: string = '/dados.kmz'): Promise<KmzParseResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Não foi possível carregar o arquivo em "${url}" (Status HTTP ${response.status}: ${response.statusText}). Certifique-se de que o arquivo "dados.kmz" existe na pasta /public.`
      );
    }

    const buffer = await response.arrayBuffer();
    const fileName = url.split('/').pop() || 'dados.kmz';
    return await parseKmzOrKmlBuffer(buffer, fileName);
  } catch (err: any) {
    return {
      success: false,
      features: [],
      metadata: {
        fileName: url.split('/').pop() || 'dados.kmz',
        fileSizeFormatted: '0 B',
        fileSizeBytes: 0,
        documentName: 'Erro ao carregar',
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
      error: err.message || 'Erro desconhecido ao carregar o arquivo KMZ.',
    };
  }
}

/**
 * Parses an ArrayBuffer of a KMZ (zip) or KML (raw xml)
 */
export async function parseKmzOrKmlBuffer(
  buffer: ArrayBuffer,
  fileName: string = 'dados.kmz'
): Promise<KmzParseResult> {
  const fileSizeBytes = buffer.byteLength;
  const fileSizeFormatted = formatFileSize(fileSizeBytes);
  let kmlText = '';
  let kmlFileName = 'doc.kml';
  const embeddedImages: Record<string, string> = {};
  let embeddedFilesCount = 0;

  try {
    // Check if buffer is actually a zip file (KMZ starts with PK\x03\x04 or 0x50, 0x4b)
    const uint8 = new Uint8Array(buffer.slice(0, 4));
    const isZip = uint8[0] === 0x50 && uint8[1] === 0x4b;

    if (isZip) {
      const zip = await JSZip.loadAsync(buffer);
      const zipFiles = Object.keys(zip.files);
      embeddedFilesCount = zipFiles.length;

      // Extract image files to object URLs for inline viewing
      for (const filePath of zipFiles) {
        const lower = filePath.toLowerCase();
        if (
          lower.endsWith('.png') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.gif') ||
          lower.endsWith('.svg') ||
          lower.endsWith('.webp')
        ) {
          try {
            const blob = await zip.files[filePath].async('blob');
            const blobUrl = URL.createObjectURL(blob);
            embeddedImages[filePath] = blobUrl;
            // Also store simple basename
            const base = filePath.split('/').pop();
            if (base) embeddedImages[base] = blobUrl;
          } catch {
            // Ignore image extraction errors
          }
        }
      }

      // Look for KML file in the zip
      let foundKmlFile = zipFiles.find((f) => f.toLowerCase() === 'doc.kml');
      if (!foundKmlFile) {
        foundKmlFile = zipFiles.find((f) => f.toLowerCase().endsWith('.kml'));
      }

      if (!foundKmlFile) {
        throw new Error('Nenhum arquivo KML válido (.kml ou doc.kml) foi encontrado dentro do arquivo KMZ.');
      }

      kmlFileName = foundKmlFile;
      kmlText = await zip.files[foundKmlFile].async('text');
    } else {
      // It's raw KML text
      const decoder = new TextDecoder('utf-8');
      kmlText = decoder.decode(buffer);
      kmlFileName = fileName.endsWith('.kml') ? fileName : `${fileName}.kml`;
    }

    // Parse KML XML DOM
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`Erro ao interpretar XML do KML: ${parserError.textContent}`);
    }

    // Extract Styles Map
    const stylesMap: Record<
      string,
      {
        lineColor?: string;
        lineWidth?: number;
        polyColor?: string;
        polyFill?: boolean;
        iconUrl?: string;
        iconColor?: string;
      }
    > = {};

    const styleElements = xmlDoc.querySelectorAll('Style');
    styleElements.forEach((styleEl) => {
      const id = styleEl.getAttribute('id');
      if (!id) return;

      const lineStyle = styleEl.querySelector('LineStyle');
      const polyStyle = styleEl.querySelector('PolyStyle');
      const iconStyle = styleEl.querySelector('IconStyle');

      stylesMap[`#${id}`] = {
        lineColor: lineStyle?.querySelector('color')?.textContent?.trim(),
        lineWidth: parseFloat(lineStyle?.querySelector('width')?.textContent || '2'),
        polyColor: polyStyle?.querySelector('color')?.textContent?.trim(),
        polyFill: polyStyle?.querySelector('fill')?.textContent?.trim() !== '0',
        iconUrl: iconStyle?.querySelector('Icon > href')?.textContent?.trim(),
        iconColor: iconStyle?.querySelector('color')?.textContent?.trim(),
      };
      // Also map without '#'
      stylesMap[id] = stylesMap[`#${id}`];
    });

    // Document Metadata
    const docName =
      xmlDoc.querySelector('Document > name, kml > name')?.textContent?.trim() ||
      fileName.replace(/\.(kmz|kml)$/i, '');
    const docDesc =
      xmlDoc.querySelector('Document > description, kml > description')?.textContent?.trim() || '';

    const features: KmzFeature[] = [];
    const foldersSet = new Set<string>();

    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    let hasValidCoords = false;

    function updateBounds(c: Coordinate) {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
      hasValidCoords = true;
    }

    // Traverse Placemarks
    const placemarkNodes = xmlDoc.querySelectorAll('Placemark');

    placemarkNodes.forEach((pm, index) => {
      const id = pm.getAttribute('id') || `feature-${index + 1}`;
      const name = pm.querySelector('name')?.textContent?.trim() || `Elemento ${index + 1}`;
      const description = pm.querySelector('description')?.textContent?.trim() || '';

      // Find Folder parent hierarchy (stack)
      const stack: string[] = [];
      let folderName = 'Geral';
      let parent = pm.parentElement;
      while (parent && parent.tagName && parent.tagName.toLowerCase() !== 'kml') {
        const tag = parent.tagName.toLowerCase();
        if (tag === 'folder' || tag === 'document') {
          const nameEl = parent.querySelector(':scope > name');
          if (nameEl?.textContent?.trim()) {
            const fName = nameEl.textContent.trim();
            stack.unshift(fName);
            if (tag === 'folder' && folderName === 'Geral') {
              folderName = fName;
            }
          }
        }
        parent = parent.parentElement;
      }
      foldersSet.add(folderName);

      // ExtendedData extraction
      const properties: Record<string, string | number | boolean> = {};
      const simpleData = pm.querySelectorAll('ExtendedData SimpleData');
      simpleData.forEach((sd) => {
        const key = sd.getAttribute('name') || 'Campo';
        const val = sd.textContent?.trim() || '';
        properties[key] = val;
      });

      const dataElements = pm.querySelectorAll('ExtendedData Data');
      dataElements.forEach((de) => {
        const key = de.getAttribute('name') || 'Dado';
        const val = de.querySelector('value')?.textContent?.trim() || '';
        properties[key] = val;
      });

      // City identification based on folder hierarchy stack & properties
      const extendedStack = [...stack];
      if (properties['Cidade']) extendedStack.push(String(properties['Cidade']));
      if (properties['cidade']) extendedStack.push(String(properties['cidade']));
      if (properties['Municipio']) extendedStack.push(String(properties['Municipio']));
      if (properties['City']) extendedStack.push(String(properties['City']));
      if (folderName && !extendedStack.includes(folderName)) extendedStack.push(folderName);
      
      const cidadeOficial = identificarCidadeOficial(extendedStack);
      properties['Projeto / Cidade'] = cidadeOficial;

      // Style resolution
      const styleUrl = pm.querySelector('styleUrl')?.textContent?.trim();
      let featureStyle: KmzFeature['style'] = undefined;
      if (styleUrl && stylesMap[styleUrl]) {
        const st = stylesMap[styleUrl];
        const lineCss = kmlColorToCss(st.lineColor);
        const polyCss = kmlColorToCss(st.polyColor);
        let iconUrl = st.iconUrl;
        if (iconUrl && embeddedImages[iconUrl]) {
          iconUrl = embeddedImages[iconUrl];
        }
        featureStyle = {
          color: lineCss?.hex || '#2563eb',
          strokeWidth: st.lineWidth || 2,
          fillColor: polyCss?.hex || lineCss?.hex || '#3b82f6',
          fillOpacity: polyCss?.opacity ?? 0.35,
          iconUrl,
          iconColor: kmlColorToCss(st.iconColor)?.hex,
        };
      }

      // Inline style tag if present in Placemark
      const inlineStyle = pm.querySelector('Style');
      if (inlineStyle) {
        const lineStyle = inlineStyle.querySelector('LineStyle');
        const polyStyle = inlineStyle.querySelector('PolyStyle');
        const iconStyle = inlineStyle.querySelector('IconStyle');
        const lineCss = kmlColorToCss(lineStyle?.querySelector('color')?.textContent?.trim());
        const polyCss = kmlColorToCss(polyStyle?.querySelector('color')?.textContent?.trim());
        const iconUrl = iconStyle?.querySelector('Icon > href')?.textContent?.trim();
        featureStyle = {
          color: lineCss?.hex || featureStyle?.color || '#2563eb',
          strokeWidth: parseFloat(lineStyle?.querySelector('width')?.textContent || '2') || featureStyle?.strokeWidth || 2,
          fillColor: polyCss?.hex || featureStyle?.fillColor || '#3b82f6',
          fillOpacity: polyCss?.opacity ?? featureStyle?.fillOpacity ?? 0.35,
          iconUrl: (iconUrl && embeddedImages[iconUrl]) ? embeddedImages[iconUrl] : iconUrl || featureStyle?.iconUrl,
        };
      }

      // Geometry extraction
      let geometryType: GeometryType = 'Unknown';
      let coordinates: Coordinate[] = [];
      const polygonRings: Coordinate[][] = [];

      const pointEl = pm.querySelector('Point');
      const lineEl = pm.querySelector('LineString');
      const polyEl = pm.querySelector('Polygon');
      const multiEl = pm.querySelector('MultiGeometry');

      if (pointEl) {
        geometryType = 'Point';
        const coordsText = pointEl.querySelector('coordinates')?.textContent || '';
        coordinates = parseKmlCoordinates(coordsText);
      } else if (lineEl) {
        geometryType = 'LineString';
        const coordsText = lineEl.querySelector('coordinates')?.textContent || '';
        coordinates = parseKmlCoordinates(coordsText);
      } else if (polyEl) {
        geometryType = 'Polygon';
        const outerCoords = polyEl.querySelector('outerBoundaryIs coordinates')?.textContent || '';
        coordinates = parseKmlCoordinates(outerCoords);
        if (coordinates.length > 0) {
          polygonRings.push(coordinates);
        }
        // Inner boundaries (holes)
        const innerBoundaries = polyEl.querySelectorAll('innerBoundaryIs coordinates');
        innerBoundaries.forEach((inner) => {
          const innerCoords = parseKmlCoordinates(inner.textContent || '');
          if (innerCoords.length > 0) {
            polygonRings.push(innerCoords);
          }
        });
      } else if (multiEl) {
        geometryType = 'MultiGeometry';
        // Pick all coordinate sets
        const allCoordEls = multiEl.querySelectorAll('coordinates');
        allCoordEls.forEach((cEl) => {
          const parsed = parseKmlCoordinates(cEl.textContent || '');
          coordinates.push(...parsed);
        });
      }

      // Update bounding box
      coordinates.forEach(updateBounds);

      // Calculate spatial metrics
      const metrics: KmzFeature['metrics'] = {};
      if (geometryType === 'LineString') {
        metrics.lengthKm = calculateLineLength(coordinates);
      } else if (geometryType === 'Polygon') {
        metrics.areaKm2 = calculatePolygonArea(coordinates);
        metrics.areaHectares = (metrics.areaKm2 || 0) * 100;
        metrics.lengthKm = calculateLineLength(coordinates);
      }

      if (coordinates.length > 0) {
        features.push({
          id,
          name,
          description,
          folder: folderName,
          cidadeOficial,
          containerStack: stack,
          geometryType,
          coordinates,
          polygonRings: polygonRings.length > 0 ? polygonRings : undefined,
          properties,
          style: featureStyle,
          metrics,
        });
      }
    });

    // Compute bounds & centers
    const bounds = hasValidCoords
      ? {
          minLat,
          minLng,
          maxLat,
          maxLng,
          centerLat: (minLat + maxLat) / 2,
          centerLng: (minLng + maxLng) / 2,
        }
      : null;

    // Convert to GeoJSON for export/interoperability
    let geojson: any = null;
    try {
      geojson = toGeoJsonKml(xmlDoc);
    } catch {
      // Fallback manual geojson
    }

    const metadata: KmzMetadata = {
      fileName,
      fileSizeFormatted,
      fileSizeBytes,
      documentName: docName,
      documentDescription: docDesc,
      totalFeatures: features.length,
      pointsCount: features.filter((f) => f.geometryType === 'Point').length,
      linesCount: features.filter((f) => f.geometryType === 'LineString').length,
      polygonsCount: features.filter((f) => f.geometryType === 'Polygon').length,
      folders: Array.from(foldersSet),
      bounds,
      loadedAt: new Date(),
      kmlFileName,
      embeddedFilesCount,
    };

    return {
      success: true,
      features,
      metadata,
      rawKml: kmlText,
      embeddedImages,
      geojson,
    };
  } catch (err: any) {
    return {
      success: false,
      features: [],
      metadata: {
        fileName,
        fileSizeFormatted,
        fileSizeBytes,
        documentName: 'Erro',
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
      error: err.message || 'Falha ao processar o arquivo KMZ/KML.',
    };
  }
}
