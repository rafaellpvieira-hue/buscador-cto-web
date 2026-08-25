export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiGeometry' | 'Unknown';

export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
}

export interface KmzFeature {
  id: string;
  name: string;
  description: string;
  folder: string;
  cidadeOficial?: string;
  containerStack?: string[];
  geometryType: GeometryType;
  coordinates: Coordinate[];
  polygonRings?: Coordinate[][]; // For polygons with holes or complex rings
  properties: Record<string, string | number | boolean>;
  style?: {
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    iconUrl?: string;
    iconColor?: string;
  };
  metrics?: {
    lengthKm?: number;
    areaKm2?: number;
    areaHectares?: number;
  };
}

export interface KmzMetadata {
  fileName: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  documentName: string;
  documentDescription: string;
  totalFeatures: number;
  pointsCount: number;
  linesCount: number;
  polygonsCount: number;
  folders: string[];
  bounds: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
    centerLat: number;
    centerLng: number;
  } | null;
  loadedAt: Date;
  kmlFileName: string;
  embeddedFilesCount: number;
}

export interface KmzParseResult {
  success: boolean;
  features: KmzFeature[];
  metadata: KmzMetadata;
  error?: string;
  rawKml?: string;
  embeddedImages?: Record<string, string>;
  geojson?: any;
}
