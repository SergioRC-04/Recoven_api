# RECOVEN Backend Service

> Enterprise Core API para la Gestión y Certificación de Residuos Ambientales.

---

![Estatus](https://img.shields.io/badge/Estatus-Producci%C3%B3n-green?style=flat-square)
![Acceso](https://img.shields.io/badge/Acceso-Privado-red?style=flat-square)
![Framework](https://img.shields.io/badge/NestJS-v11.x-E0234E?style=flat-square&logo=nestjs)
![ORM](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)
![Database](https://img.shields.io/badge/PostgreSQL-v16-336791?style=flat-square&logo=postgresql)

🔒 **AVISO DE CONFIDENCIALIDAD:** Este repositorio contiene el código fuente del núcleo lógico empresarial de RECOVEN. Es un proyecto estrictamente **PRIVADO**. Queda prohibida su distribución, clonación o exposición pública de su arquitectura interna o credenciales sin autorización expresa de la propiedad.

---

## 1. Descripción General

Este servicio constituye la API robusta y centralizada para la plataforma de servicios ambientales de **RECOVEN**. Construido bajo una arquitectura empresarial modular utilizando **NestJS**, el sistema se encarga de procesar la lógica de negocio crítica, la persistencia relacional con validación de tipos, la gestión de sesiones seguras y el despacho automatizado de certificaciones de operaciones oficiales mediante hilos de correo corporativo.

## 2. Características y Arquitectura Modular

El backend está desacoplado en módulos altamente cohesivos siguiendo el principio **DRY** y las mejores prácticas de _Clean Code_:

- **Módulo de Seguridad (Auth):** Control de accesos mediante tokens asimétricos firmados criptográficamente (JWT) con estrategias de validación e inyección de encabezados.
- **Módulo de Notificaciones (Mailer):** Motor de despacho asíncrono integrado con servidores SMTP corporativos para el envío seguro de documentación técnica adjunta.
- **Módulo de Reportes e Informes (Certificates):** Procesamiento en memoria de datos operativos para la compilación dinámica de archivos estructurados de hojas de cálculo (`exceljs`) y documentos legibles (`pdfkit`).
- **Capa de Datos Transaccional:** Abstracción y control de base de datos relacional robusta operada a través de consultas tipo-seguras con **Prisma ORM**.

## 3. Stack Tecnológico Principal

| Componente         | Tecnología                    | Propósito en el Ecosistema                                           |
| :----------------- | :---------------------------- | :------------------------------------------------------------------- |
| **Core Framework** | NestJS v11.x                  | Inyección de dependencias, modularidad y decoradores nativos.        |
| **Lenguaje**       | TypeScript v5.x               | Tipado estricto y prevención de errores en tiempo de diseño.         |
| **Mapeo de Datos** | Prisma ORM v7.x               | Modelado relacional tipo-seguro y automatización de esquemas.        |
| **Motor de BD**    | PostgreSQL / Driver `pg`      | Almacenamiento persistente transaccional con ACID garantizado.       |
| **Validación**     | Class-Validator & Transformer | Sanitización global obligatoria de DTOs en el middleware de entrada. |

## 4. Estructura de Endpoints de la API

Toda la comunicación con la API se realiza mediante el intercambio de objetos JSON, y las rutas están protegidas según el rol o el estado de autenticación del cliente. A continuación se detallan los controladores base implementados:

### 4.1. Módulo de Autenticación (`/api/auth`)

Encargado del ciclo de vida de la sesión del usuario, el aprovisionamiento de tokens de acceso y la seguridad perimetral.

- `POST /api/auth/login`
  - **Descripción:** Autentica a un usuario del sistema (administrador o asesor) mediante credenciales.
  - **Payload:** Objeto JSON con identificador y contraseña validados por DTO.
  - **Respuesta:** Retorna el token Bearer JWT y los metadatos del perfil si la operación es exitosa.
- `POST /api/auth/verify-2fa`
  - **Descripción:** Capa adicional de validación que procesa el token OTP (One-Time Password) enviado al canal corporativo para autorizar el acceso final al panel.

### 4.2. Módulo de Certificados y Gestión Ambiental (`/api/certificates`)

Gestiona los registros de recolección, compactación, poda o disposición de residuos y automatiza las salidas gráficas o documentales.

- `GET /api/certificates`
  - **Descripción:** Recupera el listado histórico de certificados emitidos. Soporta paginación y filtros dinámicos.
  - **Seguridad:** Requiere encabezado `Authorization: Bearer <JWT>`.
- `POST /api/certificates/upload`
  - **Descripción:** Registra una nueva operación ambiental en el sistema.
  - **Payload:** Multipart/Form-Data que incluye los metadatos de la recolección y los archivos adjuntos de respaldo.
- `GET /api/certificates/:id/export-pdf`
  - **Descripción:** Compila e inyecta dinámicamente en el búfer de salida el documento oficial en formato PDF (`pdfkit`) listo para descarga.
- `GET /api/certificates/export-excel`
  - **Descripción:** Consolida los rangos de datos seleccionados y genera un reporte masivo estructurado en formato `.xlsx` (`exceljs`) para auditorías internas.

### 4.3. Módulo de Leads y Contactos (`/api/leads`)

Gestiona las interacciones y solicitudes comerciales provenientes de la Landing Page pública de la empresa.

- `POST /api/leads`
  - **Descripción:** Endpoint público que recibe las solicitudes de cotización o contacto de clientes potenciales.
  - **Flujo Interno:** Almacena el registro en la base de datos a través de Prisma e interactúa con el `MailerService` para disparar una notificación inmediata al equipo administrativo de RECOVEN.

## 5. Pipeline de Compilación y Despliegue (Producción)

El backend cuenta con una arquitectura optimizada para la nube (Serverless o persistencia en contenedores mediante proxies inversos). El ciclo de vida del despliegue en producción ejecuta la siguiente secuencia de empaquetado:

1.  **Fase de Post-Instalación:** Al compilar en producción, el trigger automático `postinstall` ejecuta `prisma generate` para instanciar los binarios del cliente dentro del entorno del hosting de forma aislada.
2.  **Fase de Build Silencioso:** El comando `npm run build` invoca al CLI de Nest para transpilar el código TypeScript. Los archivos optimizados listos para ejecución se generan en la ruta física: `dist/src/`.
3.  **Fase de Ejecución Persistente:** En producción, el demonio o gestor del servidor web enciende la aplicación invocando el punto de entrada exacto y verificado mediante:
    ```bash
    npm run start:prod
    ```
    _(Ejecuta internamente: `node dist/src/main.js` mapeando dinámicamente el socket `process.env.PORT` provisto por el proveedor de infraestructura)._

## 6. Estándares de Código y Calidad

- **Validación Global:** El servidor ejecuta una instancia global de `ValidationPipe` con rechazo de propiedades no listadas (`whitelist: true`), devolviendo errores HTTP 400 estandarizados ante peticiones corruptas.
- **Políticas de CORS:** Los orígenes de consulta permitidos están estrictamente restringidos mediante arrays reactivos inyectados por el entorno de producción, denegando el acceso de forma nativa a clientes no autorizados.

---

© 2026 RECOVEN. Todos los derechos reservados. Código de propiedad privada e industrial.

```

```
