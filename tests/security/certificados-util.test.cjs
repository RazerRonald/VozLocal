// Funciones puras de js/utils/certificados.js (E04 / SC-001): archivo, avance y edad.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const util = import('data:text/javascript;base64,' + fs.readFileSync('js/utils/certificados.js').toString('base64'));
const dia = (iso) => new Date(`${iso}T12:00:00Z`);

test('HU01: fecha de nacimiento real, desde 1900 y no posterior a hoy', async () => {
  const { fechaNacimientoValida } = await util;
  const hoy = dia('2026-11-17');
  assert.equal(fechaNacimientoValida('2008-05-10', hoy), true);
  assert.equal(fechaNacimientoValida('2026-11-17', hoy), true);
  assert.equal(fechaNacimientoValida('2026-11-18', hoy), false);
  assert.equal(fechaNacimientoValida('1899-12-31', hoy), false);
  assert.equal(fechaNacimientoValida('2007-02-30', hoy), false);
  assert.equal(fechaNacimientoValida('2007-13-01', hoy), false);
  for (const invalida of ['', '10/05/2008', '2008-5-10', null, undefined]) {
    assert.equal(fechaNacimientoValida(invalida, hoy), false, String(invalida));
  }
});

test('HU01: cumple 18 el día de su cumpleaños, no antes', async () => {
  const { esMenorDeEdad, edadEnAnios } = await util;
  const hoy = dia('2026-11-17');
  assert.equal(esMenorDeEdad('2008-11-17', hoy), false);
  assert.equal(esMenorDeEdad('2008-11-18', hoy), true);
  assert.equal(esMenorDeEdad('1990-01-01', hoy), false);
  assert.equal(esMenorDeEdad('2015-06-01', hoy), true);
  assert.equal(esMenorDeEdad('fecha-mala', hoy), false);
  assert.equal(edadEnAnios('2008-11-17', hoy), 18);
  assert.equal(edadEnAnios('2008-11-18', hoy), 17);
  assert.equal(edadEnAnios('fecha-mala', hoy), null);
});

test('HU01: un nacido el 29 de febrero cumple el 1 de marzo en años no bisiestos', async () => {
  const { esMenorDeEdad } = await util;
  assert.equal(esMenorDeEdad('2008-02-29', dia('2026-02-28')), true);
  assert.equal(esMenorDeEdad('2008-02-29', dia('2026-03-01')), false);
});

test('HU01: la edad se calcula con el día UTC, igual que request.time en las reglas', async () => {
  const { esMenorDeEdad, hoyIso } = await util;
  // 23:30 del 16/11 en Colombia ya es 17/11 en UTC.
  const nocheEnColombia = new Date('2026-11-17T04:30:00Z');
  assert.equal(hoyIso(nocheEnColombia), '2026-11-17');
  assert.equal(esMenorDeEdad('2008-11-17', nocheEnColombia), false);
});

test('HU01: archivo de 5 MB exactos se acepta y uno más grande no', async () => {
  const { validarArchivoCertificado, CERTIFICADO_MAX_BYTES } = await util;
  const pdf = (n) => {
    const b = new Uint8Array(n).fill(32);
    b.set([...'%PDF-1.4\n'].map((c) => c.charCodeAt(0)));
    b.set([...'\n%%EOF\n'].map((c) => c.charCodeAt(0)), n - 7);
    return b;
  };
  assert.deepEqual(validarArchivoCertificado(pdf(CERTIFICADO_MAX_BYTES)), { ok: true, tipo: 'application/pdf' });
  assert.deepEqual(validarArchivoCertificado(pdf(CERTIFICADO_MAX_BYTES + 1)), { ok: false, error: 'tamano' });
  assert.deepEqual(validarArchivoCertificado(new Uint8Array(0)), { ok: false, error: 'vacio' });
});

test('HU05: solo suman los aprobados y la meta se cumple con 80', async () => {
  const { calcularAvance } = await util;
  const aprobado = (h) => ({ estado: 'Aprobado', horas_aprobadas: h });
  assert.equal(calcularAvance([aprobado(79), { estado: 'Pendiente', horas_aprobadas: 50 }], 80).cumplida, false);
  const avance = calcularAvance([aprobado(60), aprobado(30)], 80);
  assert.deepEqual(avance, { horas: 90, meta: 80, faltan: 0, cumplida: true, porcentaje: 100 });
});
