import { IsOptional, IsString } from 'class-validator';

export class FilterBarriosDto {
  @IsOptional()
  @IsString()
  localidadCod?: string;
}

export class FilterViasDto {
  @IsOptional()
  @IsString()
  localidadCod?: string;

  @IsOptional()
  @IsString()
  barrioCod?: string;
}

export interface GeoJsonFeatureProperties {
  [key: string]: any;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: any;
}

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string;
  properties: GeoJsonFeatureProperties;
  geometry: GeoJsonGeometry;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}
