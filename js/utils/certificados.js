/**
 * @fileoverview Funciones puras de certificados (SC-001): validación de archivo,
 * codificación en trozos y cálculo del avance. Sin imports para poder probarlas
 * en Node (tests/security/certificados-util.test.cjs).
 *
 * @module utils/certificados
 */

/** HU01: se acepta exactamente 5 MB. */
export const CERTIFICADO_MAX_BYTES = 5 * 1024 * 1024;

/** Caracteres base64 por documento: deja margen bajo el límite de 1 MiB de Firestore. */
export const CERTIFICADO_PARTE_CHARS = 700000;

const ASCII = (bytes, desde, hasta) => String.fromCharCode(...bytes.subarray(desde, hasta));

/** Reconoce el formato por la firma del contenido, no por la extensión. */
export function detectarTipo(bytes) {
  if (bytes.length >= 5 && ASCII(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 8 && bytes[0] === 0x89 && ASCII(bytes, 1, 4) === 'PNG'
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Un archivo truncado pierde su marca final; así se detecta la mayoría de corruptos. */
function estructuraCompleta(tipo, bytes) {
  if (tipo === 'application/pdf') {
    return ASCII(bytes, Math.max(0, bytes.length - 2048), bytes.length).includes('%%EOF');
  }
  if (tipo === 'image/png') {
    return bytes.length >= 20 && ASCII(bytes, bytes.length - 8, bytes.length - 4) === 'IEND';
  }
  let fin = bytes.length;
  while (fin > 0 && bytes[fin - 1] === 0x00) fin--; // algunos editores rellenan con ceros
  return fin >= 4 && bytes[fin - 2] === 0xff && bytes[fin - 1] === 0xd9;
}

/**
 * Valida un archivo de certificado.
 * @param {Uint8Array} bytes
 * @returns {{ ok: true, tipo: string } | { ok: false, error: 'vacio'|'tamano'|'formato'|'corrupto' }}
 */
export function validarArchivoCertificado(bytes) {
  if (!bytes || bytes.length === 0) return { ok: false, error: 'vacio' };
  if (bytes.length > CERTIFICADO_MAX_BYTES) return { ok: false, error: 'tamano' };
  const tipo = detectarTipo(bytes);
  if (!tipo) return { ok: false, error: 'formato' };
  if (!estructuraCompleta(tipo, bytes)) return { ok: false, error: 'corrupto' };
  return { ok: true, tipo };
}

export function bytesABase64(bytes) {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export function base64ABytes(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function partirEnTrozos(texto, tamano = CERTIFICADO_PARTE_CHARS) {
  const partes = [];
  for (let i = 0; i < texto.length; i += tamano) partes.push(texto.slice(i, i + tamano));
  return partes;
}

/** HU01: mayoría de edad en Colombia. */
export const MAYORIA_EDAD = 18;

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Partes de una fecha 'AAAA-MM-DD' que existe en el calendario, o null.
 * @param {string} texto
 */
function partesFecha(texto) {
  const m = FORMATO_FECHA.exec(String(texto ?? ''));
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

/**
 * ¿Ya se cumplieron `anios` años desde la fecha, contando el día de hoy?
 * Usa el día UTC, igual que `request.time` en firestore.rules, para que el
 * cliente y las reglas den siempre el mismo resultado. Un nacido un 29 de
 * febrero cumple el 1 de marzo en los años no bisiestos.
 */
function cumplidosAnios({ anio, mes, dia }, anios, hoy) {
  const [y, m, d] = [hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, hoy.getUTCDate()];
  const objetivo = anio + anios;
  return objetivo < y || (objetivo === y && (mes < m || (mes === m && dia <= d)));
}

/**
 * HU01: fecha de nacimiento real, desde 1900 y no posterior a hoy.
 * @param {string} texto 'AAAA-MM-DD'
 * @param {Date} [hoy]
 */
export function fechaNacimientoValida(texto, hoy = new Date()) {
  const partes = partesFecha(texto);
  return Boolean(partes) && partes.anio >= 1900 && cumplidosAnios(partes, 0, hoy);
}

/**
 * HU01: menor de edad según la fecha de nacimiento (false si la fecha no es válida).
 * @param {string} texto 'AAAA-MM-DD'
 * @param {Date} [hoy]
 */
export function esMenorDeEdad(texto, hoy = new Date()) {
  if (!fechaNacimientoValida(texto, hoy)) return false;
  return !cumplidosAnios(partesFecha(texto), MAYORIA_EDAD, hoy);
}

/**
 * Edad cumplida en años, o null si la fecha no es válida.
 * @param {string} texto 'AAAA-MM-DD'
 * @param {Date} [hoy]
 */
export function edadEnAnios(texto, hoy = new Date()) {
  if (!fechaNacimientoValida(texto, hoy)) return null;
  const partes = partesFecha(texto);
  const base = hoy.getUTCFullYear() - partes.anio;
  return cumplidosAnios(partes, base, hoy) ? base : base - 1;
}

/** Fecha de hoy como 'AAAA-MM-DD' (día UTC), para el atributo max del campo. */
export function hoyIso(hoy = new Date()) {
  return hoy.toISOString().slice(0, 10);
}

/**
 * HU05: suma solo horas de certificados Aprobados; no recorta el acumulado real.
 * @param {Array<{estado: string, horas_aprobadas: number}>} certificados
 * @param {number} meta
 */
export function calcularAvance(certificados, meta) {
  const horas = certificados
    .filter((c) => c.estado === 'Aprobado')
    .reduce((total, c) => total + (Number(c.horas_aprobadas) || 0), 0);
  return {
    horas,
    meta,
    faltan: Math.max(0, meta - horas),
    cumplida: horas >= meta,
    porcentaje: Math.min(100, Math.round((horas / meta) * 100)),
  };
}
