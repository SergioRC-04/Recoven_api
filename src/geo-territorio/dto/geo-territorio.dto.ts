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

  // Vías cercanas al trazo de UNA microrruta puntual — filtro por
  // distancia real (ST_DWithin), no por intersección contra barrio/
  // localidad, ya que el trazo dibujado a mano no calza exacto sobre
  // ninguno de los dos. Independiente de los demás filtros. String (no
  // number) porque llega crudo desde el query string, igual que
  // barrioCod/localidadCod — se castea a entero en la consulta.
  @IsOptional()
  @IsString()
  microrrutaId?: string;
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
