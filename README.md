# Voz Local — JAL Comuna 3 Manrique, Medellín

Plataforma Web Comunitaria de la **Junta Administradora Local (JAL) de la Comuna 3 Manrique**, orientada a la transparencia institucional, participación ciudadana y gestión comunal.

---

## 🏛️ Ficha Técnica y Gobernanza del Proyecto

| Campo | Detalle |
| :--- | :--- |
| **Proyecto** | Voz Local (JAL Comuna 3) |
| **Asignatura** | Calidad de Software y Auditoría de Sistemas |
| **Institución** | Institución Universitaria Pascual Bravo |
| **Metodología** | Scrum / Ágil con Aseguramiento de Calidad (QA) |
| **Versión Entregada** | `v0.2.0-sprint2` |
| **Ciclo Evaluado** | **Sprint 2 (JAL-E02 — Autenticación y Sesión)** |

### Integrantes y Roles del Equipo
* **Product Owner & QA Lead:** Juan José Echavarría Castaño
* **Scrum Master:** Sebastian Pineda Quiroz
* **Equipo de Desarrollo:**
  * Ronald Issant Enoc Briceño Silva
  * Miguel Ángel Rodríguez Gutiérrez
  * Juan Camilo Foronda Buritica
* **Equipo de QA:** Juan José Echavarría Castaño, Juan Camilo Foronda Buritica
* **Stakeholders / Docente Evaluadora:** Catalina / Yury Montoya

---

## 📦 Alcance Auditado del Release Actual (Sprint 2)

El código contenido en esta versión corresponde de manera estricta y trazable al incremento formal evaluado y verificado mediante matrices de prueba:

### 1. Sprint 1 (JAL-E01 — Portal Público Base)
* **JAL-001:** Arquitectura SPA modular (Vanilla JS ES6, Bootstrap 5, navegación sin recarga).
* **JAL-002:** Enrutamiento cliente mediante hash (`#/inicio`, `#/noticias`, `#/eventos`, `#/contacto`, `404`).
* **JAL-003 a JAL-007:** Portal institucional, banner carrusel responsivo, barra de navegación adaptable, directorio de ediles y sistema centralizado de notificaciones (*Toasts*).
* **JAL-008:** Pantalla de error 404 y vista de *Acceso Denegado*.

### 2. Sprint 2 (JAL-E02 — Autenticación y Sesión)
* **JAL-009:** Autenticación de usuarios vía Firebase Auth con validaciones de formulario y enmascaramiento de contraseña.
* **JAL-010:** Persistencia de sesión tras recargas (F5) y lectura reactiva de perfil desde Firestore.
* **JAL-011:** Control de acceso basado en roles (**RBAC**):
  * **Edil (`edil`):** Redirección al panel administrativo `#/admin`.
  * **Estudiante (`estudiante`):** Redirección a `#/inicio` y acceso a perfil ciudadano.
  * **Protección:** Bloqueo de rutas privilegiadas para roles no autorizados o visitantes.
* **JAL-012:** Cierre de sesión manual (`Logout`) con destrucción de estado y retorno a menú público.
* **JAL-013:** Cierre de sesión automático por inactividad tras 15 minutos sin interacción.
* **JAL-014:** Vista de Perfil de Usuario (`#/perfil`): consulta en tiempo real de cédula, lugar de expedición, correo, rol y nombre completo.
* **JAL-015:** Formulario de cambio de contraseña con validación de credencial anterior y confirmación.
* **JAL-016:** Presentación estructurada de secciones principales de consulta ciudadana.
* **JAL-017:** Formulario público de solicitud de acceso ciudadano (`#/solicitar-acceso`) con validaciones de captcha y campos requeridos.
* **JAL-018:** Flujo de recuperación de contraseña con respuesta genérica preventiva.
* **JAL-019:** Pruebas integrales de punta a punta (E2E), usabilidad responsiva (375px a 1280px) y navegación 100% operable por teclado (accesibilidad WCAG 2.1).

---

## 📊 Trazabilidad y Evidencias de Calidad (QA)

Cada requisito cuenta con casos de prueba documentados, ejecutados y respaldados con capturas dentro de celda y animaciones GIF vinculadas:

* **Matriz de Pruebas Sprint 1:** [`Plantilla_pruebas_JAL-E01.xlsx`](./Plantilla_pruebas_JAL-E01.xlsx) (13 casos aprobados).
* **Matriz de Pruebas Sprint 2:** [`_pruebas_JAL-E02_Auth_Sesion.xlsx`](./_pruebas_JAL-E02_Auth_Sesion.xlsx) (43 casos aprobados).
* **Repositorio de Evidencias Multimedia:** Carpeta organizada [`evidencias/`](./evidencias/) versionada en el proyecto:
  * `evidencias/sprint1/`: 13 capturas PNG y 13 animaciones GIF del Sprint 1.
  * `evidencias/sprint2/`: 43 capturas PNG y 43 animaciones GIF del Sprint 2.
  * *Portabilidad:* Los hipervínculos de las matrices Excel están configurados con **rutas relativas** (`evidencias/sprintX/...`), por lo que cualquier integrante del equipo o evaluador puede abrir y reproducir los GIFs con un solo clic tras clonar el repositorio, sin importar la ruta donde se guarde.
* **Responsable de Ejecución:** Juan José Echavarría Castaño.
* **Herramienta de Automatización:** Playwright Test Runner (Chromium / Windows 11).
* **Demostrador Visual en Pantalla:** Script interactivo [`VER_PRUEBAS_EN_PANTALLA.bat`](./VER_PRUEBAS_EN_PANTALLA.bat) con indicador HUD en tiempo real.

---

## 🌿 Política de Ramas (Git Flow) y Gestión del Alcance

Para garantizar la integridad de la auditoría y evitar deuda técnica o código no documentado (*Scope Creep*), el repositorio sigue un flujo estricto:

* **`release/sprint-2` / `main` (Incremento Auditado):**  
  Contiene exclusivamente las funcionalidades planificadas, especificadas y probadas con el 100% de cumplimiento de la Definición de Terminado (DoD) de los Sprints 1 y 2.
* **`Desarrollo` / `develop` (Entorno de Trabajo del Equipo):**  
  Rama de integración continua donde el equipo de desarrollo adelanta las tareas del **Sprint 3**, el cual inicia formalmente el **23 de octubre de 2026** según el cronograma oficial del proyecto.

> **Nota de Auditoría sobre Funcionalidades Futuras (Sprint 3):**  
> Componentes como la integración con Google Drive API, la expedición de cartas vecinales y la gestión de certificados de horas de servicio social corresponden a la **Épica 5** y a la **Solicitud de Cambio Aprobada SC-001 (Épica 6)**, cuya especificación, refinamiento y casos de prueba formales serán entregados en el cierre del Sprint 3.

---

## 🚀 Puesta en Marcha Local

### Requisitos
* Node.js v18+ 
* Navegador Chromium / Chrome

### Ejecución del Servidor
```bash
# Iniciar servidor local de desarrollo
node scripts/dev.cjs
```
La aplicación estará disponible de inmediato en: `http://127.0.0.1:3000`

### Demostración Visual de Pruebas
```bash
# Ejecutar demostración interactiva en pantalla con navegador visible y HUD:
VER_PRUEBAS_EN_PANTALLA.bat
```

---
*Documento elaborado por el Equipo de Aseguramiento de Calidad (QA) — Voz Local JAL Comuna 3.*
