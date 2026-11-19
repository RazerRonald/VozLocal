// js/utils/promesas.js: tareas asíncronas lanzadas sin esperar (eventos del DOM, temporizadores).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Se importa el archivo real (no un data: URL) para que c8 asocie la cobertura a js/utils/promesas.js.
const util = import(pathToFileURL(path.resolve('js/utils/promesas.js')).href);

test('sinEsperar registra el error de una promesa rechazada con su contexto', async () => {
  const { sinEsperar } = await util;
  const registrados = [];
  const original = console.error;
  console.error = (...args) => registrados.push(args);
  try {
    const error = new Error('falló');
    sinEsperar(Promise.reject(error), 'Vista._cargar');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(registrados, [['[Vista._cargar]', error]]);
  } finally {
    console.error = original;
  }
});

test('sinEsperar no registra nada si la promesa se cumple o si no recibe una promesa', async () => {
  const { sinEsperar } = await util;
  const registrados = [];
  const original = console.error;
  console.error = (...args) => registrados.push(args);
  try {
    sinEsperar(Promise.resolve('ok'), 'Vista._cargar');
    sinEsperar(undefined, 'Vista.render');
    sinEsperar('texto', 'Vista.render');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(registrados, []);
  } finally {
    console.error = original;
  }
});
