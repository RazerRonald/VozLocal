/**
 * @fileoverview Utilidades para promesas que no se esperan (por ejemplo, las que
 * se lanzan desde un evento del DOM o un temporizador). Sin imports para poder
 * probarlas en Node (tests/security/promesas.test.cjs).
 *
 * @module utils/promesas
 */

/**
 * Lanza una tarea asíncrona sin esperarla, pero sin perder su error: si la
 * promesa falla, se registra en la consola con el contexto indicado en lugar de
 * quedar como "unhandled rejection".
 *
 * @param {Promise<unknown>|unknown} promesa Resultado de llamar a la función asíncrona.
 * @param {string} contexto Dónde se lanzó, por ejemplo 'CertificadosView._cargar'.
 */
export function sinEsperar(promesa, contexto) {
  if (promesa && typeof promesa.catch === 'function') {
    promesa.catch((err) => console.error(`[${contexto}]`, err));
  }
}
