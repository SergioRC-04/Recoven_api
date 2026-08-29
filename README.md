# RECOVEN Backend Service

> Enterprise Core API para la Gestión Ambiental, Territorial y de Certificación de RECOVEN.

---

[![Estatus](https://img.shields.io/badge/Estatus-Producci%C3%B3n-green?style=flat-square)](#)
[![Acceso](https://img.shields.io/badge/Acceso-Privado-red?style=flat-square)](#)
[![Framework](https://img.shields.io/badge/NestJS-v11.x-E0234E?style=flat-square&logo=nestjs)](#)
[![ORM](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](#)
[![Database](https://img.shields.io/badge/PostgreSQL-v16-336791?style=flat-square&logo=postgresql)](#)

🔒 **AVISO DE CONFIDENCIALIDAD:** Este repositorio contiene el código fuente del núcleo lógico empresarial de RECOVEN. Es un proyecto estrictamente **PRIVADO**. Queda prohibida su distribución, clonación o exposición pública de su arquitectura interna o credenciales sin autorización expresa de la propiedad. Ver [LICENSE](./LICENSE).

---

## 1. Descripción General

Este servicio constituye la API robusta y centralizada para la plataforma de servicios ambientales de **RECOVEN**. Construido bajo una arquitectura empresarial modular utilizando **NestJS**, el sistema procesa la lógica de negocio crítica, la persistencia relacional con validación de tipos, la gestión de sesiones seguras, el despacho automatizado de certificaciones y notificaciones por correo, y — mediante **PostGIS** — el modelado y análisis geoespacial de la operación territorial: localidades, barrios, malla vial y microrrutas de recolección.

## 2. Características y Arquitectura Modular

El backend está desacoplado en módulos altamente cohesivos siguiendo el principio **DRY** y las mejores prácticas de _Clean Code_:

- **Módulo de Seguridad (Auth):** Control de accesos mediante tokens asimétricos firmados criptográficamente (JWT, expiración de 60 minutos) con verificación en dos factores (2FA) por correo electrónico.
- **Módulo de Notificaciones (Mail):** Motor de despacho transaccional sobre **Resend** (migrado desde SMTP genérico por problemas de entregabilidad a dominios institucionales) para códigos de verificación, certificados a empresas con verificación por QR, y alertas automáticas al equipo de desarrollo ante fallos en flujos críticos.
- **Módulo de Certificados (Certificates):** Registra el intento de envío _antes_ de subir el archivo o despachar el correo (`PENDIENTE` → `ENVIADO`/`FALLIDO`), para que ninguna falla a mitad de camino quede sin rastro. Sube el documento a Supabase Storage y despacha el correo con código QR de verificación.
- **Módulo de Empresas (Customers):** CRUD de empresas clientes destinatarias de certificados.
- **Módulo de Territorio (Geo-Territorio):** Exposición de localidades, barrios y malla vial como GeoJSON, con reproyección a EPSG:4326 para consumo en mapas web y exportación en su proyección nativa (EPSG:9377, MAGNA-SIRGAS Origen Nacional) para GeoJSON/Shapefile compatibles con QGIS/ArcGIS.
- **Módulo de Microrrutas:** CRUD de rutas de recolección con geometría PostGIS, cálculo geométrico (no asignado a mano) del barrio/localidad por los que efectivamente transcurre cada ruta mediante `ST_Intersects`/`ST_Intersection`, y generación de reportes en el formato oficial de la SSPD (Excel) además de exportaciones GIS.
- **Módulo de Recicladores (Recyclers):** Censo y clasificación de recicladores de oficio, generación de certificados de vinculación en PDF (`pdfkit`) y reportes Excel con formato condicional por estado (`exceljs`).
- **Capa de Datos Transaccional:** Abstracción y control de base de datos relacional robusta operada a través de consultas tipo-seguras con **Prisma ORM**; las consultas espaciales que requieren SQL crudo (por las funciones de PostGIS) se parametrizan con `Prisma.sql`/`Prisma.join`, nunca por concatenación de strings.

## 3. Stack Tecnológico Principal

| Componente               | Tecnología                    | Propósito en el Ecosistema                                                          |
| ------------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| **Core Framework**       | NestJS v11.x                  | Inyección de dependencias, modularidad y decoradores nativos.                       |
| **Lenguaje**             | TypeScript v5.x               | Tipado estricto y prevención de errores en tiempo de diseño.                        |
| **Mapeo de Datos**       | Prisma ORM                    | Modelado relacional tipo-seguro y automatización de esquemas.                       |
| **Motor de BD**          | PostgreSQL + PostGIS (Neon)   | Almacenamiento transaccional con ACID garantizado y cálculos espaciales nativos.    |
| **Almacenamiento**       | Supabase Storage              | Archivos adjuntos: certificados y documentos de PQRSDF.                             |
| **Correo Transaccional** | Resend                        | Envío de códigos 2FA, certificados con QR y alertas de error.                       |
| **Reportes .xlsx**       | ExcelJS                       | Reporte SUI de microrrutas y exportaciones de recicladores con formato condicional. |
| **Reportes .pdf**        | PDFKit                        | Certificados de vinculación de recicladores.                                        |
| **Validación**           | Class-Validator & Transformer | Sanitización global obligatoria de DTOs en el middleware de entrada.                |

## 4. Estructura de Endpoints de la API

Toda la comunicación con la API se realiza mediante el intercambio de objetos JSON (salvo las descargas de archivos, que devuelven binarios con las cabeceras `Content-Type`/`Content-Disposition` correspondientes), y las rutas están protegidas según el rol o el estado de autenticación del cliente.

### 4.1. Módulo de Autenticación (`/auth`)

Encargado del ciclo de vida de la sesión del usuario, el aprovisionamiento de tokens de acceso y la seguridad perimetral. Todos los endpoints están limitados por `@Throttle` contra fuerza bruta.

- `POST /auth/login` — Valida credenciales y, si son correctas, dispara el código 2FA por correo (no entrega el token todavía).
- `POST /auth/verify-2fa` — Valida el código recibido y entrega el `access_token` (JWT, expira en 60 minutos).
- `POST /auth/resend-2fa` — Reenvía un nuevo código 2FA.

### 4.2. Módulo de Certificados (`/certificates`)

Gestiona el despacho de certificados a empresas clientes (poda o residuos aprovechables) y su historial.

- `POST /certificates/upload` — `multipart/form-data` con el archivo y los metadatos (empresa, tipo). Sube el archivo a Supabase, registra el intento en estado `PENDIENTE` antes de cualquier paso riesgoso, envía el correo con QR de verificación, y actualiza el registro a `ENVIADO` o `FALLIDO` según el resultado. Si falla, notifica automáticamente por correo al equipo de desarrollo con el detalle del error.
- `GET /certificates/history` — Historial completo de certificados, con su estado y (si aplica) el detalle del error.

### 4.3. Módulo de Empresas (`/customers`)

- `GET /customers` — Listado de empresas clientes, ordenado alfabéticamente.
- `POST /customers` — Crea una empresa cliente.
- `PUT /customers/:id` — Actualiza nombre/correo.
- `DELETE /customers/:id` — Elimina una empresa cliente.

### 4.4. Módulo de Territorio (`/geo-territorio`)

Capa geoespacial pública (sin autenticación, son datos administrativos, no personales) usada tanto por el mapa público como por el panel de administración.

- `GET /geo-territorio/localidades` — GeoJSON de localidades (EPSG:4326).
- `GET /geo-territorio/barrios?localidadCod=` — GeoJSON de barrios, opcionalmente filtrado por localidad.
- `GET /geo-territorio/vias?localidadCod=&barrioCod=` — GeoJSON de la malla vial.
- `GET /geo-territorio/localidades/exportar?formato=geojson|shp` — Exportación en la proyección nativa (EPSG:9377) para QGIS/ArcGIS.
- `GET /geo-territorio/barrios/exportar?formato=&localidadCod=` — Ídem para barrios.
- `GET /geo-territorio/vias/exportar?formato=&localidadCod=&barrioCod=` — Ídem para vías.

### 4.5. Módulo de Microrrutas (`/microrrutas`)

- `GET /microrrutas?barrioCod=&localidadCod=` — GeoJSON de microrrutas (EPSG:4326), público.
- `POST /microrrutas` — Crea una microrruta (requiere JWT).
- `PUT /microrrutas/:id` — Actualiza los atributos SUI de una microrruta (requiere JWT).
- `PUT /microrrutas/:id/geometria` — Reemplaza únicamente la geometría del trazo (requiere JWT).
- `DELETE /microrrutas/:id` — Elimina una microrruta (requiere JWT).
- `GET /microrrutas/:id/ubicacion` — Resuelve geométricamente (intersección espacial en PostGIS, por longitud de solape) el barrio y la localidad por los que efectivamente pasa la ruta.
- `GET /microrrutas/exportar-excel?barrioCod=&localidadCod=` — Reporte en el formato oficial de microrrutas de la SSPD.
- `GET /microrrutas/exportar-capa?formato=geojson|shp&barrioCod=&localidadCod=` — Exportación GIS en EPSG:9377 (requiere JWT).

### 4.6. Módulo de Recicladores (`/recyclers`)

Todos los endpoints requieren JWT.

- `GET /recyclers?tab=&censado=&search=` — Listado filtrable por pestaña (con ruta, sin ruta, nuevos, a quitar, desvinculados), estado de censo y búsqueda por nombre/cédula.
- `POST /recyclers` — Crea un reciclador (con barrios y microrrutas asignados).
- `PUT /recyclers/:id` — Actualiza datos y asignaciones.
- `PATCH /recyclers/:id/toggle-censo` — Alterna el estado de censo.
- `DELETE /recyclers/:id` — Desvincula (soft delete, pasa al histórico).
- `PATCH /recyclers/:id/reactivar` — Revierte la desvinculación.
- `GET /recyclers/:id/certificado` — Certificado de vinculación en PDF (dos copias por hoja).
- `GET /recyclers/exportar?tipo=` — Reporte Excel por estado, con formato condicional de color en censo, asignación de ruta y clasificación.

### 4.7. Módulo de Leads (`/leads`)

Gestiona las interacciones y solicitudes comerciales provenientes de la Landing Page pública.

- `POST /leads` — Endpoint público que recibe solicitudes de cotización o contacto.

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

- **Validación Global:** El servidor ejecuta una instancia global de `ValidationPipe` con rechazo de propiedades no listadas (`whitelist: true`), devolviendo errores HTTP 400 estandarizados ante peticiones corruptas.
- **Políticas de CORS:** Los orígenes de consulta permitidos están estrictamente restringidos mediante arrays reactivos inyectados por el entorno de producción, denegando el acceso de forma nativa a clientes no autorizados.
- **Consultas espaciales parametrizadas:** Toda consulta raw que involucra funciones de PostGIS (`ST_Intersects`, `ST_Length`, `ST_Transform`, etc.) construye sus fragmentos con `Prisma.sql`/`Prisma.join` en vez de interpolar valores directamente en el string SQL — cierra la puerta a inyección SQL sin perder la expresividad que requieren los filtros espaciales dinámicos.
- **Registro antes que optimismo:** Los flujos que combinan más de un paso externo con posibilidad de fallo (subida a almacenamiento + envío de correo) registran el intento en la base de datos _antes_ de ejecutar esos pasos, no después — así una falla a mitad de camino no deja de tener rastro.

---

## 📄 Licencia y Propiedad Intelectual

Este repositorio es de **acceso público en GitHub exclusivamente con fines de portafolio profesional y demostración técnica** — no implica autorización de uso, copia, modificación ni distribución. Ver el archivo [LICENSE](./LICENSE) para los términos completos.

---

© 2026 RECOVEN. Todos los derechos reservados. Código de propiedad privada e industrial.
