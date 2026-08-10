import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import type { SentMessageInfo } from 'nodemailer';
import * as QRCode from 'qrcode';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: {
      filename: string;
      content: Buffer;
      contentType?: string;
    }[];
  }): Promise<SentMessageInfo> {
    return await this.mailerService.sendMail({
      from: process.env.MAIL_FROM,
      ...options,
    });
  }

  async sendSecurityCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email, // Correo del administrador que intenta loguearse
      from: process.env.MAIL_FROM,
      subject: '🔒 Código de verificación de seguridad - RECOVEN',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 500px;">
          <h2 style="color: #111827; margin-bottom: 4px;">Control de Acceso</h2>
          <p style="color: #4b5563; font-size: 14px;">Se ha solicitado un inicio de sesión en el panel administrativo de RECOVEN.</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <span style="font-size: 12px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Tu código de verificación</span>
            <h1 style="color: #10b981; margin: 8px 0 0 0; font-size: 32px; letter-spacing: 6px; font-family: monospace;">${code}</h1>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">Este código expirará en 5 minutos. Si no solicitaste este acceso, puedes ignorar este correo de forma segura.</p>
        </div>
      `,
    });
  }

  async sendCertificateEmail(
    emailDestinatario: string,
    nombreEmpresa: string,
    tipo: 'PODA' | 'RESIDUOS',
    file: Express.Multer.File,
    certificateUrl: string, // <-- Recibimos la URL de Supabase
  ) {
    const esPoda = tipo === 'PODA';
    const subject = esPoda
      ? 'Certificado de Disposición Final de Residuos de Poda - RECOVEN ECA'
      : 'Certificado de Disposición Final de Residuos Diversos - RECOVEN ECA';

    const tituloCertificado = esPoda
      ? 'Certificado de Manejo y Disposición Final de Residuos Orgánicos Aprovechables'
      : 'Certificado de Manejo y Disposición Final de Residuos';

    const parrafoDetalle = esPoda
      ? 'correspondiente a las actividades de poda ejecutadas en las zonas de recolección autorizadas.'
      : 'correspondiente a los proyectos corporativos especiales y de materiales diversos procesados en nuestras plantas de clasificación.';

    // 1. Generar la imagen del QR en un Buffer usando la URL de Supabase
    const qrBuffer = await QRCode.toBuffer(certificateUrl, {
      type: 'png',
      width: 250,
      margin: 2,
      color: {
        dark: '#059669', // Verde corporativo
        light: '#FFFFFF',
      },
    });

    // 2. Texto plano de respaldo
    const textoPlano = `
Estimado equipo de ${nombreEmpresa},

Cordial saludo por parte de RECOVEN ECA SAS ESP.

Adjunto a este mensaje encontrará el ${tituloCertificado} ${parrafoDetalle}

Puede verificar y consultar el documento digital escaneando el código QR en el correo o ingresando directamente a:
${certificateUrl}

Atentamente,
RECOVEN ECA SAS ESP
Barranquilla, Atlántico, Colombia
  `;

    await this.mailerService.sendMail({
      to: emailDestinatario,
      from: process.env.MAIL_FROM,
      subject: subject,
      text: textoPlano,
      html: `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Inter', sans-serif;">
          <div style="font-family: 'Inter', sans-serif; color: #1f2937; max-width: 600px; margin: 30px auto; line-height: 1.6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; background-color: #ffffff;">
            
            <div style="text-align: center; margin-bottom: 25px;">
              <img src="https://recovenesp.com/assets/img/logo.png" alt="RECOVEN Logo" style="width: 150px;" />
            </div>
            
            <h2 style="color: #059669; border-bottom: 2px solid #f3f4f6; padding-bottom: 12px; font-size: 20px; margin-top: 0;">
              Emisión de Certificado Ambiental Oficial
            </h2>
            
            <p>Estimado equipo de <strong>${nombreEmpresa}</strong>,</p>
            
            <p>Cordial saludo por parte del equipo técnico y administrativo de <strong>RECOVEN ECA SAS ESP</strong>.</p>
            
            <p>De manera formal y en cumplimiento de los estándares operativos, adjunto a este mensaje encontrará el <strong>${tituloCertificado}</strong> ${parrafoDetalle}</p>
            
            <!-- SECCIÓN DEL CÓDIGO QR -->
            <div style="background-color: #f9fafb; border: 1px dashed #10b981; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #065f46;">
                🔍 Verificación Digital con Código QR
              </p>
              <p style="margin: 0 0 15px 0; font-size: 12px; color: #4b5563;">
                Escanee el siguiente código QR con la cámara de su dispositivo móvil para acceder al documento oficial guardado en nuestro servidor seguro:
              </p>
              <img src="cid:qrcode-certificate" alt="Código QR del Certificado" style="width: 180px; height: 180px; border-radius: 6px; border: 1px solid #e5e7eb; padding: 6px; background-color: #ffffff;" />
              <p style="margin-top: 12px; font-size: 12px;">
                <a href="${certificateUrl}" target="_blank" style="color: #059669; text-decoration: underline; font-weight: 500;">
                  O haga clic aquí para abrir/descargar el certificado
                </a>
              </p>
            </div>

            <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #374151; font-weight: 500;">
                ℹ️ El documento oficial firmado también ha sido anexado directamente como archivo adjunto a este correo electrónico.
              </p>
            </div>

            <p style="font-size: 14px; color: #6b7280;">
              Agradecemos su confianza en nuestros servicios orientados al desarrollo de la economía circular, la transformación ecológica y la gestión ambiental responsable bajo el estricto cumplimiento de la normativa legal vigente de la República de Colombia.
            </p>
            
            <br/>
            <hr style="border: 0; border-top: 1px solid #e5e7eb;" />
            
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0; font-weight: bold; color: #4b5563;">RECOVEN ECA SAS ESP</p>
              <p style="margin: 4px 0 0 0;">Barranquilla, Atlántico, Colombia</p>
              <p style="font-size: 11px; margin-top: 10px; color: #ca8a04;">⚠️ Por favor, no responda a este correo electrónico, es una notificación automatizada despachada por los sistemas centrales.</p>
            </div>
          </div>
        </body>
      </html>
    `,
      attachments: [
        {
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        },
        {
          filename: 'qr-certificado.png',
          content: qrBuffer,
          cid: 'qrcode-certificate', // Referenciado como cid:qrcode-certificate en la etiqueta <img>
        },
      ],
    });
  }
}
