// src/common/decorators/normalize-nombre-propio.decorator.ts
//
// Normaliza un nombre a Título Simple sin importar en qué formato llegue
// ("ANGELA ISABEL OSORIO BERRIO", "angela isabel osorio berrio", mezclado,
// con espacios de más) → "Angela Isabel Osorio Berrio". Mismo patrón que
// Trim()/NormalizeEmail(): un Transform de class-transformer, así que
// requiere que el ValidationPipe global tenga transform: true (ya
// habilitado en main.ts) para que el valor transformado sea el que
// realmente llega al service, no solo el que se valida.
//
// También capitaliza cada parte de nombres compuestos con guion (p. ej.
// "ana-maría" → "Ana-María"), no solo la primera letra de la palabra
// completa. No trata como excepción los conectores en minúscula que usa
// la ortografía formal en español (p. ej. "de los", "de la") — si hace
// falta ese matiz, hay que agregarlo aparte.
import { Transform } from 'class-transformer';

function capitalizarPalabra(palabra: string): string {
  return palabra
    .split('-')
    .map((parte) =>
      parte.length > 0 ? parte.charAt(0).toUpperCase() + parte.slice(1) : parte,
    )
    .join('-');
}

export function NormalizeNombrePropio(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .split(' ')
      .map(capitalizarPalabra)
      .join(' ');
  });
}
