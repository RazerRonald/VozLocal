# Cobertura de las pruebas unitarias (unittest) — Sprint 3

| Dato | Valor |
|---|---|
| Fecha de ejecución | 19/11/2026 |
| Ejecutó | Ronald Briceño (con Claude Code) |
| Rama medida | `test/cobertura-90-sprint3` (código de la app igual a `main` `c93382b`) |
| Pruebas | `python -m unittest discover -s tests/unittest`: **88 pruebas, todas OK** (antes 42) |
| Herramientas | Python 3.12.10 · coverage.py 7.17.3 · Node 24.21 · c8 12.0.0 |
| **Criterio de aceptación** | **Cobertura mínima de 90 %**: los comandos fallan si no se cumple |

## Resumen

| Medición | Qué mide | Mínimo | Resultado |
|---|---|---|---|
| `coverage report -m` (coverage.py) | Los archivos Python de `tests/unittest/` | 90 % | ✅ **99 %** (536 sentencias, 7 sin ejecutar) |
| c8 sobre los módulos del Sprint 3 | `utils/certificados.js`, `CertificadoController`, `ArchivoController`, `CertificadoModel` | 90 % por archivo en líneas, sentencias, funciones y ramas | ✅ **100 % de líneas** · 100 % de funciones · **95,13 % de ramas** |
| c8 sobre todo `js/` (informativo) | Todo el JavaScript de la app, sin `js/vendor/` | Sin mínimo | 20,40 % de líneas · 89,10 % de ramas |

**Cómo leer los números:** las pruebas de `unittest` están escritas en Python, pero lo que prueban es el JavaScript real de la app. `tests/unittest/puente.py` lo ejecuta con Node. coverage.py solo mide código Python, así que su resultado indica qué tanto se ejecutan los archivos de prueba. La cobertura de la app que esas pruebas ejercitan se mide con **c8**, la cobertura nativa de V8/Node, y sobre ella se exige también el 90 %.

### Antes y después

| Módulo | Líneas antes | Líneas ahora | Ramas ahora |
|---|---|---|---|
| `js/utils/certificados.js` | 95,54 % | **100 %** | 95,77 % |
| `js/controllers/CertificadoController.js` | 89,80 % | **100 %** | 98,09 % |
| `js/models/CertificadoModel.js` | 52,15 % | **100 %** | 100 % |
| `js/controllers/ArchivoController.js` | 45,59 % | **100 %** | 91,77 % |
| **Total de los módulos del Sprint 3** | **62,55 %** | **100 %** | **95,13 %** |

## 1. `coverage report -m` (coverage.py)

Comando: `npm run coverage:unittest`. El mínimo está en `.coveragerc` (`fail_under = 90`), así que también se aplica si se corre `coverage report -m` a mano.

```
Name                                                     Stmts   Miss  Cover   Missing
--------------------------------------------------------------------------------------
tests\unittest\puente.py                                    12      1    92%   22
tests\unittest\test_controlador_certificados_flujos.py      80      1    99%   152
tests\unittest\test_controlador_tramites.py                102      1    99%   292
tests\unittest\test_juan_camilo_avance_eliminacion.py       65      1    98%   116
tests\unittest\test_modelo_certificados.py                  82      1    99%   175
tests\unittest\test_ronald_registro_revision.py            133      1    99%   206
tests\unittest\test_sebastian_correccion_reversion.py       62      1    98%   108
--------------------------------------------------------------------------------------
TOTAL                                                      536      7    99%
```

Las 7 líneas que faltan son esperadas:
- `puente.py:22` es el `raise` que solo se dispara si Node falla. Como ninguna prueba falló, no se ejecutó.
- La línea final de cada `test_*.py` es `unittest.main()` dentro de `if __name__ == '__main__'`. No corre cuando se usa `discover`.

## 2. Cobertura del JavaScript de los módulos del Sprint 3 (c8)

Comando: `npm run coverage:js`. Usa `--check-coverage --per-file` con 90 % en líneas, sentencias, funciones y ramas, así que falla si **cualquiera** de los cuatro archivos baja de 90 %.

```
---------------------------|---------|----------|---------|---------|-------------------------------
File                       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------------------|---------|----------|---------|---------|-------------------------------
All files                  |     100 |    95.13 |     100 |     100 |
 controllers               |     100 |    94.29 |     100 |     100 |
  ArchivoController.js     |     100 |    91.77 |     100 |     100 | ...39,470-475,477-479,558,584
  CertificadoController.js |     100 |    98.09 |     100 |     100 | 200,224
 models                    |     100 |      100 |     100 |     100 |
  CertificadoModel.js      |     100 |      100 |     100 |     100 |
 utils                     |     100 |    95.77 |     100 |     100 |
  certificados.js          |     100 |    95.77 |     100 |     100 | 35,84,149
---------------------------|---------|----------|---------|---------|-------------------------------
Statements   : 100% ( 1199/1199 )
Branches     : 95.13% ( 352/370 )
Functions    : 100% ( 77/77 )
Lines        : 100% ( 1199/1199 )
```

Con 100 % de líneas, la columna "Uncovered Line #s" muestra solo **ramas** sin recorrer: valores por defecto (`||`, `??`) que las pruebas no necesitan forzar, como los nombres globales alternativos de las librerías DOCX.

## 3. Pruebas nuevas (46)

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `tests/unittest/test_modelo_certificados.py` | 13 | `CertificadoModel` contra un Firestore simulado: registro en un solo lote (HU01), corrección con nueva versión (HU03), listados ordenados, lectura y archivo incompleto (HU02/HU05), aprobación, rechazo y reversión con relectura del estado (HU02/HU04) y constancia de eliminación (HU06) |
| `tests/unittest/test_controlador_tramites.py` | 17 | `ArchivoController`: historial, solicitud y finalización del estudiante (JAL-020 a JAL-022, JAL-029); generación del DOCX, descarga, subida a Drive y expedición (JAL-025 a JAL-028, JAL-030); aprobación y rechazo con sugerencia (JAL-023, JAL-024, JAL-031); carga de PizZip/docxtemplater desde scripts locales y CDN de respaldo |
| `tests/unittest/test_controlador_certificados_flujos.py` | 16 | `CertificadoController` sin sesión y con errores de Firestore; listados del revisor; archivo entregado como Blob local (HU06); imágenes que no se decodifican (HU01 criterio 4); `edadEnAnios` y `hoyIso` |

Para probar sin Firestore, Drive ni navegador, `tests/unittest/simular_cdn_hooks.mjs` ahora permite que cada prueba defina el comportamiento de las funciones del CDN de Firebase con `globalThis.__cdn = { writeBatch: () => ..., getDocs: async () => ... }`. Si una prueba no lo define, todo sigue funcionando como antes. Las 42 pruebas anteriores no cambiaron.

## 4. Todo `js/` (informativo)

`npm run coverage:js:todo`: **20,40 %** de líneas (antes 17,02 %). No tiene mínimo:
- Las vistas (`js/views/`) y los componentes necesitan navegador y DOM; se verifican con `tests/responsive/check.mjs` (Playwright).
- Noticias, eventos, autenticación y solicitudes de acceso son épicas de sprints anteriores, fuera del alcance de las pruebas del Sprint 3.

## Otras pruebas que no entran en esta medición

| Suite | Comando | Resultado |
|---|---|---|
| Pruebas de Node (seguridad, utilidades) | `npm test` | 15/15 |
| Reglas de Firestore en el emulador | `npm run test:rules` (requiere Java 21) | 13/13 |
| Responsive (Playwright) | `cd tests/responsive && node check.mjs` | 187/200; certificados 20/20 |

## Cómo reproducirlo

```
npm install                 # instala c8 (devDependency)
pip install coverage        # coverage.py
npm run coverage            # las dos mediciones con mínimo de 90 %
npm run coverage:unittest   # solo coverage report -m (mínimo 90 % en .coveragerc)
npm run coverage:js         # solo c8 sobre los módulos del Sprint 3 (90 % por archivo)
npm run coverage:js:todo    # informativo: todo js/
```

Si una medición queda por debajo de 90 %, el comando termina con error. Por ejemplo, c8 muestra `ERROR: Coverage for lines (…) does not meet threshold (90%)` y coverage.py sale con código 2.
