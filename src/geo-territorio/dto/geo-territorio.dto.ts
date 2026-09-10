import { IsOptional, IsString } from 'class-validator';

// No existía filtro para localidades — se agrega solo para 'municipio',
// que es el único filtro que tiene sentido aquí (a diferencia de
// barrios/vías, una localidad no se filtra "por otra localidad").
export class FilterLocalidadesDto {
  // "BARRANQUILLA" | "PUERTO_COLOMBIA" — sin filtrar, trae las de ambos.
  @IsOptional()
  @IsString()
  municipio?: string;
}

export class FilterBarriosDto {
  @IsOptional()
  @IsString()
  localidadCod?: string;

  // Independiente de localidadCod: permite "todos los barrios de Puerto
  // Colombia" sin tener que elegir una localidad puntual primero (hoy
  // Puerto Colombia solo tiene una, pero esto sigue funcionando igual si
  // más adelante se subdivide en corregimientos).
  @IsOptional()
  @IsString()
  municipio?: string;
}

export class FilterViasDto {
  @IsOptional()
  @IsString()
  localidadCod?: string;

  @IsOptional()
  @IsString()
  barrioCod?: string;

  // Igual que en FilterBarriosDto — independiente de localidadCod/barrioCod.
  @IsOptional()
  @IsString()
  municipio?: string;
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
