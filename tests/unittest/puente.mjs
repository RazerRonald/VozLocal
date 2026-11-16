// Puente para las pruebas unittest de Python: importa módulos reales de js/ y
// ejecuta un fragmento de código con ellos. Entrada por stdin (JSON):
//   { "imports": { "Alias": "js/ruta/modulo.js" }, "codigo": "return Alias.fn(1);" }
// Salida: una línea JSON con el valor devuelto.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

register('./simular_cdn_hooks.mjs', import.meta.url);

// Sin navegador: lo mínimo que algunos módulos tocan al importarse.
const vacio = () => null;
globalThis.window ??= globalThis;
globalThis.localStorage ??= { getItem: vacio, setItem: vacio, removeItem: vacio };
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.document ??= {
  getElementById: vacio, querySelector: vacio, querySelectorAll: () => [],
  addEventListener: vacio, createElement: () => ({}),
};

let entrada = '';
for await (const trozo of process.stdin) entrada += trozo;
const { imports, codigo } = JSON.parse(entrada);

const modulos = {};
for (const [alias, ruta] of Object.entries(imports)) {
  const mod = await import(pathToFileURL(path.resolve(ruta)).href);
  modulos[alias] = mod.default ?? mod;
}

const fn = new Function(...Object.keys(modulos), `return (async () => { ${codigo} })();`);
const resultado = await fn(...Object.values(modulos));
process.stdout.write(`${JSON.stringify(resultado ?? null)}\n`);
