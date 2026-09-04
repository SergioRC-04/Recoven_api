// src/common/utils/stream-to-buffer.util.ts
//
// Convierte un stream (p. ej. un PDFDocument de pdfkit, que es a la vez
// legible y escribible) en un Buffer completo — usado por cualquier
// generador de PDF que necesite subir el resultado a Supabase Storage en
// vez de transmitirlo directo a la respuesta HTTP. Antes vivía duplicada
// dentro de metrics-report.util.ts; se extrajo aquí en cuanto un segundo
// módulo (recyclers) la necesitó también.

export function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}
