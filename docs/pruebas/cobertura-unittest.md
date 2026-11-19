# Cobertura de las pruebas unitarias (unittest) — Sprint 3

| Dato | Valor |
|---|---|
| Fecha de ejecución | 18/11/2026 |
| Ejecutó | Ronald Briceño (con Claude Code) |
| Commit medido | `81361ac` (rama `main`, Sprint 3 completo) |
| Pruebas | `python -m unittest discover -s tests/unittest`: **42 pruebas, todas OK** |
| Herramientas | Python 3.12.10 · coverage.py 7.17.3 · Node 24.21 · c8 12.0.0 |

## Resumen

| Medición | Qué mide | Cobertura |
|---|---|---|
| `coverage report -m` (coverage.py) | Los archivos **Python** de `tests/unittest/` | **99 %** (272 sentencias, 4 sin ejecutar) |
| c8 sobre los módulos que prueban las suites | `utils/certificados.js`, `CertificadoController`, `ArchivoController`, `CertificadoModel` | **62,55 %** de líneas · 84,69 % de ramas |
| c8 sobre todo `js/` (sin `js/vendor/`) | Todo el JavaScript de la app | **17,02 %** de líneas · 75,11 % de ramas |

**Cómo leer los números:** las pruebas de `unittest` están escritas en Python, pero lo que prueban es el JavaScript real de la app. `tests/unittest/puente.py` lo ejecuta con Node. coverage.py solo puede medir código Python, así que su **99 %** indica que se ejecutaron casi todas las líneas de los archivos de prueba, no qué parte de la app quedó probada. Para eso se midió también el JavaScript que corre durante las mismas 42 pruebas, con **c8**, la cobertura nativa de V8/Node.

## 1. `coverage report -m` (coverage.py)

Comando: `npm run coverage:unittest`, que equivale a:

```
python -m coverage run -m unittest discover -s tests/unittest
python -m coverage report -m
```

```
Name                                                    Stmts   Miss  Cover   Missing
-------------------------------------------------------------------------------------
tests\unittest\puente.py                                   12      1    92%   22
tests\unittest\test_juan_camilo_avance_eliminacion.py      65      1    98%   116
tests\unittest\test_ronald_registro_revision.py           133      1    99%   206
tests\unittest\test_sebastian_correccion_reversion.py      62      1    98%   108
-------------------------------------------------------------------------------------
TOTAL                                                     272      4    99%
```

Las 4 líneas que faltan son esperadas:
- `puente.py:22` es el `raise` que se dispara solo si Node falla. Como ninguna prueba falló, no se ejecutó.
- La línea final de cada `test_*.py` es `unittest.main()` dentro de `if __name__ == '__main__'`. No corre cuando se usa `discover`.

## 2. Cobertura del JavaScript que ejercitan las pruebas (c8)

Comando: `npm run coverage:js`, que equivale a:

```
c8 --all --src js --include "js/**/*.js" --exclude "js/vendor/**" \
   --reporter=text --reporter=text-summary \
   python -m unittest discover -s tests/unittest
```

c8 registra la cobertura de cada proceso de Node que lanza `puente.py`. Con `--all` también cuenta, en 0 %, los archivos que ninguna prueba carga.

### Módulos que prueban las suites de unittest

| Archivo | % Líneas | % Ramas | % Funciones | Líneas sin ejecutar |
|---|---|---|---|---|
| `js/utils/certificados.js` | **95,54** | 95,23 | 85,71 | 130-134, 138-139 |
| `js/controllers/CertificadoController.js` | **89,80** | 81,60 | 88,88 | 37-39, 66-67, 91-92, 100-101, 119-120, 129-138, 234-235, 239-240, 251 |
| `js/models/CertificadoModel.js` | 52,15 | 100 | 0 | 45-63, 71-85, 89-97, 102-105, 110-111, 116-121, 125-128, 132-135, 140-145, 153-160, 165-170, 174-177, 181-182 |
| `js/controllers/ArchivoController.js` | 45,59 | 71,87 | 25,92 | 21-40, 50-76, 108-113, 120-142, 153-164, 174-185, 196-217, 221-230, 237-252, 259-281, 288-310, 317, 325-401, 408-411, 418-442, 449-463, 554, 558, 562, 583-586, 594-597 |
| **Total de estos módulos** | **62,55** | **84,69** | **47,29** | |

Qué significan esos números:
- **`utils/certificados.js` (95,54 %):** las líneas sin ejecutar son `edadEnAnios` y `hoyIso`. Esas dos funciones sí se prueban, pero en `tests/security/certificados-util.test.cjs` (`npm test`), que no entra en esta medición.
- **`CertificadoController` (89,80 %):** faltan sobre todo los caminos de error de Firestore (`catch`), `obtenerArchivo` y `listarTodos`.
- **`CertificadoModel` (52,15 %, 0 % de funciones):** en las pruebas unitarias el modelo se reemplaza por espías para probar el controlador sin Firestore. Solo se ejecuta la definición del módulo. Las escrituras reales del modelo se validan contra el emulador en `tests/integration/certificados.rules.test.cjs` (`npm run test:rules`).
- **`ArchivoController` (45,59 %):** las suites cubren normalización, validación, nombres de archivo y carpeta de Drive de los trámites (JAL-020 a JAL-032). No ejecutan los flujos que dependen de Firestore, Google Drive y la generación DOCX en el navegador.

### Todo `js/` (salida completa de c8)

```
--------------------------------|---------|----------|---------|---------|--------------------------
File                            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------------------|---------|----------|---------|---------|--------------------------
All files                       |   17.02 |    75.11 |    20.9 |   17.02 |
 js                             |       0 |        0 |       0 |       0 |
  app.js                        |       0 |        0 |       0 |       0 | 1-397
 js/components                  |       0 |        0 |       0 |       0 |
  AccessCaptcha.js              |       0 |        0 |       0 |       0 | 1-44
  Carousel.js                   |       0 |        0 |       0 |       0 | 1-293
  DriveConnectionBubble.js      |       0 |        0 |       0 |       0 | 1-198
  Navbar.js                     |       0 |        0 |       0 |       0 | 1-330
  Toast.js                      |       0 |        0 |       0 |       0 | 1-158
 js/config                      |     100 |      100 |     100 |     100 |
  collections.js                |     100 |      100 |     100 |     100 |
  firebase.config.js            |     100 |      100 |     100 |     100 |
  i18n.js                       |     100 |      100 |     100 |     100 |
 js/controllers                 |   24.62 |    76.42 |   46.93 |   24.62 |
  ArchivoController.js          |   45.59 |    71.87 |   25.92 |   45.59 | (ver tabla anterior)
  AuthController.js             |       0 |        0 |       0 |       0 | 1-409
  CertificadoController.js      |    89.8 |     81.6 |   88.88 |    89.8 | (ver tabla anterior)
  EventoController.js           |       0 |        0 |       0 |       0 | 1-286
  NoticiaController.js          |       0 |        0 |       0 |       0 | 1-306
  SolicitudAccesoController.js  |       0 |        0 |       0 |       0 | 1-186
 js/models                      |   30.88 |    54.54 |    2.06 |   30.88 |
  ArchivoModel.js               |   47.31 |       75 |    7.69 |   47.31 | ...8-592,601-633,656-658
  AuthModel.js                  |   43.26 |      100 |       0 |   43.26 | ...6,510-513,517-519,523
  CertificadoModel.js           |   52.15 |      100 |       0 |   52.15 | (ver tabla anterior)
  DriveAuthModel.js             |   31.38 |      100 |       0 |   31.38 | ...7-444,448-452,456-458
  EventoModel.js                |       0 |        0 |       0 |       0 | 1-176
  NoticiaMediaModel.js          |       0 |        0 |       0 |       0 | 1-257
  NoticiaModel.js               |       0 |        0 |       0 |       0 | 1-182
  SolicitudAccesoModel.js       |       0 |        0 |       0 |       0 | 1-88
 js/utils                       |   85.22 |    93.75 |      80 |   85.22 |
  apiResponse.js                |       0 |        0 |       0 |       0 | 1-19
  certificados.js               |   95.54 |    95.23 |   85.71 |   95.54 | 130-134,138-139
 js/views                       |       0 |        0 |       0 |       0 |
  AdminCertificadosView.js      |       0 |        0 |       0 |       0 | 1-352
  AdminSolicitudesAccesoView.js |       0 |        0 |       0 |       0 | 1-374
  AdminUsuariosView.js          |       0 |        0 |       0 |       0 | 1-676
  AdminView.js                  |       0 |        0 |       0 |       0 | 1-1779
  CertificadosView.js           |       0 |        0 |       0 |       0 | 1-463
  EstudianteView.js             |       0 |        0 |       0 |       0 | 1-624
  LoginView.js                  |       0 |        0 |       0 |       0 | 1-265
  PerfilView.js                 |       0 |        0 |       0 |       0 | 1-240
  PublicoView.js                |       0 |        0 |       0 |       0 | 1-1317
  SolicitudAccesoView.js        |       0 |        0 |       0 |       0 | 1-185
--------------------------------|---------|----------|---------|---------|--------------------------

=============================== Coverage summary ===============================
Statements   : 17.02% ( 2262/13284 )
Branches     : 75.11% ( 163/217 )
Functions    : 20.9% ( 37/177 )
Lines        : 17.02% ( 2262/13284 )
================================================================================
```

Algunos módulos quedan en 0 %:
- **Vistas (`js/views/`) y componentes:** necesitan navegador y DOM. Algunas pruebas de unittest leen su código fuente como texto para revisar su estructura, y eso no cuenta como ejecución. Se verifican con `tests/responsive/check.mjs` (Playwright).
- **Noticias, eventos, autenticación y solicitudes de acceso:** son épicas de sprints anteriores que las suites de unittest del Sprint 3 no cubren.

## Otras pruebas que no entran en esta medición

| Suite | Comando | Resultado (17/11/2026) |
|---|---|---|
| Pruebas de Node (seguridad, utilidades) | `npm test` | 15/15 |
| Reglas de Firestore en el emulador | `npm run test:rules` (requiere Java 21) | 13/13 |
| Responsive (Playwright) | `cd tests/responsive && node check.mjs` | 187/200; certificados 20/20 |

## Cómo reproducirlo

```
npm install                 # instala c8 (devDependency)
pip install coverage        # coverage.py
npm run coverage:unittest   # coverage report -m
npm run coverage:js         # cobertura del JavaScript con c8
```

Los archivos generados (`.coverage` y `coverage/`) están en `.gitignore`.
