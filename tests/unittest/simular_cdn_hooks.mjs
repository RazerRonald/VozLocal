// Hooks de Node: cada import 'https://...' (Firebase por CDN) se reemplaza por un
// módulo falso que exporta exactamente los nombres que pide quien lo importa.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('https://')) return nextResolve(specifier, context);
  const fuente = readFileSync(fileURLToPath(context.parentURL), 'utf8');
  const clausula = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapar(specifier)}['"]`).exec(fuente);
  const nombres = clausula
    ? clausula[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    : [];
  return { url: `simulado:${encodeURIComponent(nombres.join(','))}`, shortCircuit: true };
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith('simulado:')) return nextLoad(url, context);
  const nombres = decodeURIComponent(url.slice('simulado:'.length)).split(',').filter(Boolean);
  // Un único objeto que sirve como función, clase y propiedad: cualquier uso devuelve el mismo falso.
  // Una prueba puede reemplazar cualquier nombre con globalThis.__cdn = { writeBatch: () => ..., ... }:
  // la búsqueda se hace en cada llamada, así que basta con definirlo antes de usar el módulo.
  const source = `
    const falso = new Proxy(function () {}, {
      get: (_, p) => (p === 'then' ? undefined : falso),
      apply: () => falso,
      construct: () => falso,
    });
    const real = (nombre) => globalThis.__cdn?.[nombre];
    const simulado = (nombre) => new Proxy(function () {}, {
      get: (_, p) => (real(nombre) !== undefined ? real(nombre)[p] : (p === 'then' ? undefined : falso)),
      apply: (_, esto, args) => (typeof real(nombre) === 'function' ? real(nombre).apply(esto, args) : falso),
      construct: (_, args) => (typeof real(nombre) === 'function' ? new (real(nombre))(...args) : falso),
    });
    export default falso;
    ${nombres.map((n) => `export const ${n} = simulado(${JSON.stringify(n)});`).join('\n')}
  `;
  return { format: 'module', source, shortCircuit: true };
}
