# RECOVEN Backend Service

> Enterprise Core API para la Gestión y Certificación de Residuos Ambientales.

---

[![Estatus](https://img.shields.io/badge/Estatus-Producci%C3%B3n-green?style=flat-square)]()
[![Licencia](https://img.shields.io/badge/Licencia-Propietaria-red?style=flat-square)]()
[![Framework](https://img.shields.io/badge/NestJS-v11.x-E0234E?style=flat-square&logo=nestjs)]()
[![ORM](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)]()
[![Database](https://img.shields.io/badge/PostgreSQL%20%2B%20PostGIS-336791?style=flat-square&logo=postgresql)]()

📌 Repositorio del backend de **RECOVEN**, publicado con fines de portafolio profesional. El código es de uso **propietario**: se puede consultar libremente, pero su reutilización, redistribución o despliegue no están permitidos sin autorización.

---

## 1. Descripción General

Este servicio constituye la API robusta y centralizada para la plataforma de servicios ambientales de **RECOVEN**. Construido bajo una arquitectura empresarial modular utilizando **NestJS**, el sistema procesa la lógica de negocio crítica de la compañía: la gestión de clientes empresariales, la certificación y despacho de operaciones ambientales, la atención del canal ciudadano de PQRSDF, la captura de leads comerciales, la cartografía geoespacial del territorio de operación y la generación de reportes e indicadores de gestión, todo con persistencia relacional validada por tipos y sesiones administrativas protegidas.

## 2. Características y Arquitectura Modular

El backend está desacoplado en módulos altamente cohesivos siguiendo el principio **DRY** y las mejores prácticas de _Clean Code_:

- **Módulo de Seguridad (Auth):** Control de accesos mediante tokens asimétricos firmados criptográficamente (JWT) con estrategias de validación e inyección de encabezados. Incluye verificación en dos pasos (2FA) por código enviado al correo del administrador.
- **Módulo de Clientes (Customers):** CRUD administrativo de las empresas cliente (`EmpresasClientes`) sobre las cuales se emiten certificados.
- **Módulo de Certificados y Gestión Ambiental (Certificates):** Registro de operaciones de recolección, poda o disposición de residuos; sube el soporte documental a almacenamiento en la nube y despacha automáticamente el certificado al cliente por correo.
- **Módulo de PQRSDF:** Canal público de Peticiones, Quejas, Reclamos, Sugerencias, Denuncias y Felicitaciones para ciudadanos, con generación de radicado único, consulta de estado autenticada por identificación, y panel administrativo de gestión/respuesta.
- **Módulo de Leads:** Captura las solicitudes de cotización o contacto provenientes de la Landing Page pública, las persiste y notifica al equipo comercial por correo.
- **Módulo de Analítica y Reportes (Analytics/Metrics):** Indicadores mensuales de aprovechamiento y rechazo por sede, con generación dinámica de gráficas (`@napi-rs/canvas`) embebidas en reportes PDF (`pdfkit`).
- **Módulo Geoespacial (Geo-Territorio):** Expone las capas cartográficas de localidades, barrios y la red vial (formato GeoJSON) sobre una base de datos con extensión **PostGIS**, con soporte de filtrado espacial por intersección geométrica.
- **Módulo de Notificaciones (Mailer):** Motor de despacho asíncrono integrado con servidores SMTP corporativos para el envío seguro de documentación técnica adjunta.
- **Capa de Datos Transaccional:** Abstracción y control de base de datos relacional robusta operada a través de consultas tipo-seguras con **Prisma ORM**.

## 3. Stack Tecnológico Principal

| Componente              | Tecnología                            | Propósito en el Ecosistema                                           |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| **Core Framework**      | NestJS v11.x                          | Inyección de dependencias, modularidad y decoradores nativos.        |
| **Lenguaje**            | TypeScript v5.x                       | Tipado estricto y prevención de errores en tiempo de diseño.         |
| **Mapeo de Datos**      | Prisma ORM v7.x                       | Modelado relacional tipo-seguro y automatización de esquemas.        |
| **Motor de BD**         | PostgreSQL / Driver `pg`              | Almacenamiento persistente transaccional con ACID garantizado.       |
| **Datos Geoespaciales** | PostGIS + GeoJSON                     | Modelado y consulta espacial de localidades, barrios y vías.         |
| **Almacenamiento**      | Supabase Storage                      | Persistencia de archivos adjuntos (certificados, soportes PQRSDF).   |
| **Autenticación**       | Passport-JWT + bcrypt                 | Emisión de tokens, verificación 2FA y hash seguro de contraseñas.    |
| **Reportes**            | pdfkit, exceljs, @napi-rs/canvas      | Generación de PDFs, hojas de cálculo y gráficas para reportes.       |
| **Notificaciones**      | Nodemailer / `@nestjs-modules/mailer` | Envío transaccional de correo (2FA, certificados, leads, PQRSDF).    |
| **Validación**          | Class-Validator & Transformer         | Sanitización global obligatoria de DTOs en el middleware de entrada. |
| **Seguridad HTTP**      | Helmet + `@nestjs/throttler`          | Cabeceras de seguridad estándar y rate limiting por IP.              |

## 4. Estructura de Endpoints de la API

Toda la comunicación con la API se realiza mediante el intercambio de objetos JSON (o `multipart/form-data` cuando hay archivos adjuntos). Las rutas se sirven sin prefijo global (es decir, `/auth/login`, no `/api/auth/login`) y están protegidas según el rol o el estado de autenticación del cliente mediante `JwtAuthGuard`.

### 4.1. Módulo de Autenticación (`/auth`)

Encargado del ciclo de vida de la sesión del administrador, el aprovisionamiento de tokens de acceso y la seguridad perimetral.

- `POST /auth/login` — Autentica al administrador con `username` y `password` (hash bcrypt). Si son válidas, dispara un código 2FA al correo registrado y responde `{ requires2FA: true }`.
- `POST /auth/verify-2fa` — Recibe `{ username, code }`, valida el código temporal (expira a los 5 min) y retorna el `access_token` (JWT Bearer).
- `POST /auth/resend-2fa` — Recibe `{ username }` y reenvía un nuevo código 2FA.

### 4.2. Módulo de Clientes (`/customers`) 🔒 _Requiere JWT_

CRUD de las empresas cliente sobre las que se emiten certificados.

- `GET /customers` — Lista todas las empresas registradas (para el dropdown del panel admin).
- `POST /customers` — Crea una nueva empresa (`nombre`, `correo`).
- `PUT /customers/:id` — Actualiza `nombre` y/o `correo` de una empresa (UUID).
- `DELETE /customers/:id` — Elimina una empresa por su UUID.

### 4.3. Módulo de Certificados (`/certificates`) 🔒 _Requiere JWT_

Gestiona el registro y despacho de certificaciones ambientales.

- `POST /certificates/upload` — `multipart/form-data` con el archivo adjunto y `{ empresaId (UUID), tipo: 'PODA' | 'RESIDUOS' }`. Sube el archivo a Supabase Storage, registra el certificado en base de datos y lo envía automáticamente por correo al cliente.
- `GET /certificates/history` — Retorna el histórico de certificados emitidos, incluyendo nombre y correo de la empresa asociada.

### 4.4. Módulo de PQRSDF (`/pqrsdf`)

Canal de atención ciudadana (Peticiones, Quejas, Reclamos, Sugerencias, Denuncias, Felicitaciones).

**Endpoints públicos:**

- `POST /pqrsdf` — `multipart/form-data` opcional con archivo adjunto y los datos del peticionario (`tipo`, `nombreCompleto`, `tipoIdentificacion`, `numeroIdentificacion`, `email`, `telefono?`, `direccion?`, `asunto`, `descripcion`). Genera un radicado único (`PQRS-YYYYMM-XXXX`) y confirma la recepción.
- `POST /pqrsdf/consultar` — Recibe `{ radicado, numeroIdentificacion }` (verificación de dos factores) y retorna el estado del caso.

**Endpoints privados** 🔒 _Requiere JWT_:

- `GET /pqrsdf/list` — Listado completo para el panel administrativo.
- `PATCH /pqrsdf/estado/:id` — Actualiza `{ estado, respuesta? }`, con posibilidad de adjuntar un archivo de respuesta.

### 4.5. Módulo de Leads (`/leads`)

Gestiona las interacciones y solicitudes comerciales provenientes de la Landing Page pública.

- `POST /leads/send-lead` — Endpoint público que recibe la solicitud de cotización/contacto, la persiste en base de datos y notifica al equipo administrativo por correo.
- `GET /leads` 🔒 _Requiere JWT_ — Lista los leads registrados para el panel admin.
- `GET /leads/export_excel` 🔒 _Requiere JWT_ — Genera y descarga un `.xlsx` con el histórico completo de leads.

### 4.6. Módulo de Analítica y Reportes (`/metrics`)

Indicadores mensuales de gestión (aprovechamiento y rechazo de residuos por sede).

- `GET /metrics` — Retorna los indicadores registrados (pensado para alimentar las gráficas del dashboard público).
- `PUT /metrics` 🔒 _Requiere JWT_ — Crea o actualiza (`upsert`) el indicador de una sede/mes/año (`sede`, `mes`, `year`, `aprovechamiento`, `rechazo`).
- `DELETE /metrics` 🔒 _Requiere JWT_ — Elimina el indicador de una sede/mes/año puntual.
- `GET /metrics/export_pdf` — Compila un reporte histórico en PDF con gráficas generadas dinámicamente.

> ℹ️ `GET /metrics` y `GET /metrics/export_pdf` no requieren autenticación actualmente. Si no están pensados como indicadores públicos (p. ej. para un dashboard de sostenibilidad en la Landing Page), revisar si deberían protegerse con `JwtAuthGuard`.

### 4.7. Módulo Geoespacial (`/geo-territorio`)

Sirve las capas cartográficas de la ciudad como `FeatureCollection` GeoJSON, consultadas directamente sobre PostGIS. Pensado para alimentar un visor de mapas en el frontend.

- `GET /geo-territorio/localidades` — Retorna todas las localidades.
- `GET /geo-territorio/barrios?localidadCod=` — Retorna los barrios; el filtro por localidad es opcional.
- `GET /geo-territorio/vias?localidadCod=&barrioCod=` — Retorna la red vial, opcionalmente filtrada por intersección espacial con una localidad o barrio.

> ℹ️ Ninguno de los tres requiere autenticación ni tiene rate limiting (`@SkipThrottle()`), y los filtros son opcionales — sin ellos, `vias` devuelve el dataset completo (~14.700 features, ~8 MB) en una sola respuesta. Al ser datos públicos que casi no cambian, se recomienda servirlos con cabeceras `Cache-Control` en lugar de dejarlos completamente sin límite, para evitar que una petición repetida sin filtros se vuelva costosa en cómputo/egress.

## 5. Pipeline de Compilación y Despliegue (Producción)

El backend cuenta con una arquitectura optimizada para la nube (Serverless o persistencia en contenedores mediante proxies inversos). El ciclo de vida del despliegue en producción ejecuta la siguiente secuencia de empaquetado:

1. **Fase de Post-Instalación:** Al compilar en producción, el trigger automático `postinstall` ejecuta `prisma generate` para instanciar los binarios del cliente dentro del entorno del hosting de forma aislada.
2. **Fase de Build Silencioso:** El comando `npm run build` invoca al CLI de Nest para transpilar el código TypeScript. Los archivos optimizados listos para ejecución se generan en la ruta física: `dist/src/`.
3. **Fase de Ejecución Persistente:** En producción, el demonio o gestor del servidor web enciende la aplicación invocando el punto de entrada exacto y verificado mediante:

```
npm run start:prod
```

_(Ejecuta internamente: `node dist/src/main.js` mapeando dinámicamente el socket `process.env.PORT` provisto por el proveedor de infraestructura)._

## 6. Estándares de Código y Calidad

- **Validación Global:** El servidor ejecuta una instancia global de `ValidationPipe`, devolviendo errores HTTP 400 estandarizados ante peticiones corruptas o con tipos inválidos. _(Si se requiere rechazo estricto de propiedades no listadas en los DTOs, configurar `whitelist: true` y `forbidNonWhitelisted: true` en `main.ts`.)_
- **Políticas de CORS:** Los orígenes de consulta permitidos están estrictamente restringidos mediante `CORS_ORIGINS`, una variable de entorno inyectada por el entorno de producción, denegando el acceso de forma nativa a clientes no autorizados.
- **Autenticación:** Contraseñas hasheadas con `bcrypt`; sesiones administrativas protegidas con JWT + verificación 2FA por correo.
- **Rate Limiting:** `@nestjs/throttler` aplicado globalmente (60 req/min por IP) mediante `APP_GUARD`, con límites más estrictos en las rutas sensibles a fuerza bruta: `auth/login` y `auth/verify-2fa` (5/min), `auth/resend-2fa` (3/min) y `pqrsdf/consultar` (10/min).
- **Cabeceras HTTP:** `helmet()` habilitado globalmente en `main.ts` para las cabeceras de seguridad estándar (HSTS, X-Content-Type-Options, etc.), con `trust proxy` configurado para identificar correctamente la IP real del cliente detrás del proxy de despliegue.

---

© 2026 RECOVEN. Todos los derechos reservados. Código de propiedad privada e industrial.
