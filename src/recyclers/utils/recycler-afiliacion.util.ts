// src/recyclers/utils/recycler-afiliacion.util.ts
//
// "Solicitud de Inclusión en el Censo de Recicladores de Oficio" —
// reemplaza al certificado de vinculación viejo (recycler-certificado.util.ts,
// borrado). Reproduce a mano, con pdfkit, el formato exacto del Word que
// mandó el usuario (RECOVEN ya como ORO, dirigido a la Alcaldía de
// Barranquilla) — no hay forma de convertir un .docx a PDF sin un binario
// externo (LibreOffice), que no está disponible en producción (Vercel,
// serverless).
//
// No se guarda en ningún lado (ni Supabase ni la BD): se genera al vuelo
// cada vez que se pide la descarga (ver RecyclersService), así siempre
// refleja los datos actuales del reciclador (barrios/rutas pueden cambiar
// después de creado) en vez de quedar "congelado" en lo que había el día
// que se generó una sola vez.

import PDFDocument from 'pdfkit';

const COOPERATIVA_NOMBRE = 'RECOVEN ECA SAS ESP';

// "Años/meses que lleva reciclando" ya NO se calcula ni se llena: en la
// BD solo está fechaIngreso (tiempo vinculado a RECOVEN), que no es lo
// mismo que los años reciclando en general — ese campo queda en blanco
// para todos, sin excepción, en vez de inventar un número con un dato
// que no responde la pregunta real.

// Barrio con su propia regla de días — ver obtenerDiasMarcados.
const BARRIO_LA_PLAYA = 'La Playa';

// Corregimientos: no son barrios de una localidad de Barranquilla, así
// que no se reportan igual que el resto — ver obtenerLocalidadYBarriosTexto.
const CORREGIMIENTOS = ['La Playa', 'Juan Mina'];

const HORARIO_FIJO = '7:00 a.m. a 5:00 p.m.';

export interface BarrioAfiliacion {
  nombre: string;
  localidadNombre: string | null;
}

export interface MicrorrutaAfiliacion {
  diasFrecuencia: string | null;
}

export interface DatosAfiliacion {
  cedula: string;
  nombreCompleto: string;
  telefono: string | null;
  detalleUbicacion: string | null;
  barrios: BarrioAfiliacion[];
  microrrutas: MicrorrutaAfiliacion[];
}

function tieneBarrio(barrios: BarrioAfiliacion[], nombre: string): boolean {
  return barrios.some((b) => b.nombre === nombre);
}

/**
 * Texto de "localidad(es) y/o Comunas" y de "barrios" — La Playa/Juan
 * Mina son corregimientos, no barrios de una localidad de Barranquilla,
 * así que van como "Corregimiento de X" en el campo de localidad y no
 * aportan nada al campo de barrios.
 */
export function obtenerLocalidadYBarriosTexto(barrios: BarrioAfiliacion[]): {
  localidades: string;
  barrios: string;
} {
  const localidades = new Set<string>();
  const barriosNormales = new Set<string>();

  for (const b of barrios) {
    if (CORREGIMIENTOS.includes(b.nombre)) {
      localidades.add(`Corregimiento de ${b.nombre}`);
    } else {
      if (b.localidadNombre) localidades.add(b.localidadNombre);
      barriosNormales.add(b.nombre);
    }
  }

  return {
    localidades: [...localidades].join(', '),
    barrios: [...barriosNormales].join(', '),
  };
}

const ORDEN_DIAS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;
type NombreDia = (typeof ORDEN_DIAS)[number];

// Código SUI (1 a 7, Lunes a Domingo) -> nombre del día. 8 = Eventual, no
// aporta ningún día fijo (ver obtenerDiasMarcados).
const CODIGO_A_DIA: Record<number, NombreDia> = {
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
  7: 'domingo',
};

// Nombre para mostrar (con tilde) de cada día — ORDEN_DIAS/CODIGO_A_DIA
// usan la versión sin tilde como clave interna.
const ETIQUETA_DIA: Record<NombreDia, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};

/**
 * Qué días marcar: si tiene microrruta(s), la unión de los días de todas
 * (una ruta "Eventual" no aporta ninguno); si no tiene ninguna ruta fija,
 * cae al horario por defecto — distinto para La Playa (martes/jueves/
 * sábado) que para el resto (lunes/miércoles/viernes).
 */
export function obtenerDiasMarcados(
  microrrutas: MicrorrutaAfiliacion[],
  barrios: BarrioAfiliacion[],
): Record<NombreDia, boolean> {
  const marcados = new Set<NombreDia>();

  for (const m of microrrutas) {
    if (!m.diasFrecuencia) continue;
    for (const codigo of m.diasFrecuencia.split('-')) {
      const dia = CODIGO_A_DIA[Number(codigo)];
      if (dia) marcados.add(dia);
    }
  }

  if (marcados.size === 0) {
    const diasDefecto: NombreDia[] = tieneBarrio(barrios, BARRIO_LA_PLAYA)
      ? ['martes', 'jueves', 'sabado']
      : ['lunes', 'miercoles', 'viernes'];
    diasDefecto.forEach((d) => marcados.add(d));
  }

  return Object.fromEntries(
    ORDEN_DIAS.map((d) => [d, marcados.has(d)]),
  ) as Record<NombreDia, boolean>;
}

/**
 * Dibuja el documento completo — mismo texto del formato original,
 * campo por campo (ver el mapeo en el plan). Lo que no hay dato para
 * llenar (lugar de expedición, años/meses reciclando, medio de
 * transporte, discapacidad, autorizaciones de datos, firma, huella)
 * queda en blanco, tal cual en la plantilla — no se inventa nada.
 */
export function generarDocumentoAfiliacionPdf(
  datos: DatosAfiliacion,
): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
  doc.font('Helvetica').fontSize(10);

  const { localidades, barrios } = obtenerLocalidadYBarriosTexto(datos.barrios);
  const dias = obtenerDiasMarcados(datos.microrrutas, datos.barrios);

  // La X de un día marcado va subrayada, para que se vea como si se
  // hubiera escrito a mano sobre la rayita en blanco — por eso esta
  // línea no puede armarse como un solo string (parrafo no permite
  // mezclar estilos dentro del mismo texto): cada día se escribe en su
  // propia llamada a doc.text() con continued:true para que sigan en el
  // mismo renglón. pdfkit no "apaga" el underline solo: si no se pasa
  // underline:false explícito en los textos de después de la X, se queda
  // pegado ahí también (lo marcó el usuario — salía subrayado hasta
  // "miércoles").
  const renderizarLineaDias = () => {
    doc.text('Los días: ', { continued: true, underline: false });
    ORDEN_DIAS.forEach((dia, indice) => {
      const esUltimo = indice === ORDEN_DIAS.length - 1;
      doc.text(`${ETIQUETA_DIA[dia]} `, { continued: true, underline: false });
      if (dias[dia]) {
        doc.text('X', { continued: true, underline: true });
      } else {
        doc.text('___', { continued: true, underline: false });
      }
      doc.text(esUltimo ? '.' : ', ', {
        continued: !esUltimo,
        underline: false,
      });
    });
    doc.moveDown(1);
  };

  const parrafo = (
    texto: string,
    opciones: { espacioDespues?: number } = {},
  ) => {
    doc.text(texto, { align: 'justify' });
    doc.moveDown(opciones.espacioDespues ?? 1);
  };

  // Para resaltar, dentro de un párrafo, justo los pedazos que el
  // sistema rellenó solo (nombre, cédula, localidad/barrios, horario,
  // nombre de la ORO...) — un string con { dato: '...' } sale subrayado,
  // uno plano no. Mismo mecanismo de doc.text() encadenado (continued)
  // que renderizarLineaDias, con underline:false explícito en cada
  // pedazo plano para que no se quede "pegado" del pedazo subrayado
  // anterior.
  //
  // IMPORTANTE al armar los `segmentos`: el espacio que separa un pedazo
  // del siguiente va siempre al FINAL del pedazo anterior, nunca al
  // inicio del siguiente. Es un bug de pdfkit (no de underline — pasa
  // igual con texto plano): si un pedazo queda al principio de una línea
  // por el salto de página/renglón, el espacio inicial del pedazo que le
  // sigue se pierde, aunque los dos terminen en el mismo renglón.
  const parrafoMixto = (
    segmentos: (string | { dato: string })[],
    opciones: { espacioDespues?: number } = {},
  ) => {
    segmentos.forEach((segmento, indice) => {
      const esUltimo = indice === segmentos.length - 1;
      const esDato = typeof segmento === 'object';
      doc.text(esDato ? segmento.dato : segmento, {
        continued: !esUltimo,
        underline: esDato,
        align: 'justify',
      });
    });
    doc.moveDown(opciones.espacioDespues ?? 1);
  };

  parrafo('En Barranquilla, _______________________', {
    espacioDespues: 2,
  });
  parrafo('Señores', { espacioDespues: 0 });
  parrafo('Alcaldía de Barranquilla,', { espacioDespues: 0 });
  parrafo('Barranquilla', { espacioDespues: 2 });
  parrafo(
    'Asunto: Solicitud de Inclusión en el Censo de Recicladores de Oficio del Municipio o Distrito.',
    { espacioDespues: 2 },
  );

  parrafoMixto([
    'El (la) Suscrito(a) ',
    { dato: datos.nombreCompleto },
    ', mayor de edad, identificado (a) con cédula de ciudadanía número ',
    { dato: `${datos.cedula} ` },
    'de __________________, manifiesto de manera libre, espontánea y voluntaria, y bajo ' +
      'la gravedad de juramento que ejerzo de manera habitual, actividades de recuperación, ' +
      'recolección, transporte y/o clasificación de residuos sólidos ordinarios ' +
      'aprovechables,  para su posterior reincorporación al ciclo económico productivo, y ' +
      'que de esta actividad deriva mi sustento propio y el de mi familia, de conformidad ' +
      'con lo establecido en el Decreto 1077 de 2015.',
  ]);

  parrafo(
    'Así mismo, manifiesto que desarrollo esta actividad desde hace __________ años y/o ' +
      '___________ meses, en el municipio o distrito Barranquilla.',
  );

  parrafoMixto([
    'La actividad la  realizó en la(s) localidad(es) y/o Comunas de: ',
    localidades ? { dato: `${localidades} ` } : '_____ ',
    'en los barrios: ',
    barrios ? { dato: barrios } : '_____',
  ]);

  renderizarLineaDias();

  parrafoMixto(['En los horarios: ', { dato: HORARIO_FIJO }]);

  parrafo(
    'El medio de transporte que utilizo para transportar el material reciclable es: ' +
      '__________________________________________________________________.',
    { espacioDespues: 2 },
  );

  parrafo(
    'Indique si se encuentra asociado(a) a una Organización de Recicladores de Oficio (ORO)',
    {
      espacioDespues: 0,
    },
  );
  parrafoMixto(['SI  ', { dato: 'X  ' }, 'NO _____'], { espacioDespues: 0 });
  parrafoMixto(
    [
      'En caso afirmativo, indique el nombre de la Organización de Recicladores de Oficio (ORO): ',
      { dato: COOPERATIVA_NOMBRE },
    ],
    { espacioDespues: 2 },
  );

  parrafo(
    'Indique la bodega, Centro de Acopio Temporal (CAT) y/o Estación de Clasificación y ' +
      'Aprovechamiento (ECA) donde comercializa el material aprovechable recolectado y/o ' +
      'recuperado:',
    { espacioDespues: 0 },
  );
  parrafoMixto(
    [
      'Nombre ',
      { dato: `${COOPERATIVA_NOMBRE} ` },
      'y la dirección ',
      { dato: 'Carrera 38 #123-45, Barranquilla' },
      '.',
    ],
    { espacioDespues: 2 },
  );

  parrafo('Indique si presenta una condición de discapacidad:', {
    espacioDespues: 0,
  });
  parrafo('SI_____ NO____', { espacioDespues: 0 });
  parrafo('En caso afirmativo, señale el tipo de discapacidad:', {
    espacioDespues: 0,
  });
  parrafo(
    'Física____ Auditiva____ Múltiple____ Sordo - Ciego____ Visual____ Cognitiva____ ' +
      'Psicosocial____ Otra ¿Cuál? ____________',
    { espacioDespues: 2 },
  );

  parrafo(
    'En cumplimiento de la Ley 1581 de 2012, reglamentada parcialmente por el Decreto 1377 ' +
      'de 2013 (Derogado parcialmente por el Decreto 1081 de 2015), y el Decreto 1074 de ' +
      '2015, y las demás normas vigentes que regulan la protección de datos personales en ' +
      'Colombia. Como titular de la información, al completar los datos solicitados, ' +
      'SI____ NO ____ autorizo de manera previa, libre, expresa e informada a la Entidad ' +
      'Territorial Barranquilla para realizar el tratamiento de mis datos personales. Estos ' +
      'datos se utilizarán para realizar la verificación de los requisitos de inclusión al ' +
      'Censo de Recicladores de Oficio del Municipio.',
  );
  parrafo(
    'Así mismo SI____ NO ____, autorizo libre, expresa e inequívocamente a la Entidad ' +
      'Territorial Barranquilla, la notificación de la respuesta de la presente solicitud al ' +
      'correo electrónico: ______________________________________________. En caso de que ' +
      'la Entidad Territorial Barranquilla no pueda realizar la notificación personal, ' +
      'SI____ NO ____, autorizo que de conformidad con el art. 69 del CPACA la notificación ' +
      'se realice por aviso en la página web o en la cartelera de atención al ciudadano, ' +
      'dentro de los 5 días posteriores a la expedición del acto administrativo que resuelva ' +
      'la presente solicitud.',
  );

  parrafo(
    'Declaro que la información suministrada en la presente solicitud es verídica y ' +
      'autorizó a la Entidad Territorial para verificarla por los medios legalmente ' +
      'procedentes.',
    { espacioDespues: 2 },
  );

  // Huella — un solo recuadro redondeado a la derecha de los datos de
  // firma (antes eran dos, uno a cada lado, y el bloque de abajo se
  // dibujaba con align:'justify' en todo el ancho de la página — con
  // valores cortos como el nombre o la cédula eso estira los espacios
  // entre palabras y hace que se vea mal). Las primeras 5 líneas quedan
  // angostas, al lado del recuadro; la última (nombre de la ORO, más
  // larga) va debajo, ya con el ancho completo.
  const anchoContenido =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const anchoHuella = 140;
  const espacioHuella = 20;
  const anchoAngosto = anchoContenido - anchoHuella - espacioHuella;
  const yBloque = doc.y;
  const xHuella = doc.page.margins.left + anchoAngosto + espacioHuella;
  const altoHuella = 115;

  doc.roundedRect(xHuella, yBloque, anchoHuella, altoHuella, 8).stroke();
  doc
    .fontSize(9)
    .text('HUELLA', xHuella, yBloque + 12, {
      width: anchoHuella,
      align: 'center',
    })
    .text('(Índice Derecho)', xHuella, yBloque + 24, {
      width: anchoHuella,
      align: 'center',
    });
  doc.fontSize(10);

  const lineaAngosta = (texto: string) => {
    doc.text(texto, doc.page.margins.left, doc.y, {
      width: anchoAngosto,
      align: 'left',
    });
  };

  // Igual que lineaAngosta, pero subraya el valor (si hay) — mismo
  // mecanismo de continued text que parrafoMixto, con la posición
  // explícita (x, doc.y) solo en el primer pedazo de cada línea.
  const lineaAngostaMixta = (etiqueta: string, valor: string) => {
    if (!valor) {
      lineaAngosta(etiqueta);
      return;
    }
    doc.text(etiqueta, doc.page.margins.left, doc.y, {
      width: anchoAngosto,
      continued: true,
      underline: false,
    });
    doc.text(valor, { continued: false, underline: true });
  };

  doc.y = yBloque;
  lineaAngosta('Firma: _______________________');
  lineaAngostaMixta('Nombre: ', datos.nombreCompleto);
  lineaAngostaMixta('Documento de Identificación No: ', datos.cedula);
  lineaAngostaMixta('Número de celular: ', datos.telefono ?? '');
  lineaAngostaMixta('Dirección de la casa: ', datos.detalleUbicacion ?? '');

  doc.x = doc.page.margins.left;
  doc.y = Math.max(doc.y, yBloque + altoHuella) + 14;
  parrafoMixto(
    [
      'Organización a la que pertenece como asociado: ',
      { dato: COOPERATIVA_NOMBRE },
    ],
    { espacioDespues: 0 },
  );

  return doc;
}
