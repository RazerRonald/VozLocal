// Reglas de Firestore de la E04 · Certificados de servicio social (SC001-HU01 a HU06).
// Requiere el emulador de Firestore en 127.0.0.1:8088 (firebase.test.json):
//   npx firebase emulators:exec --config firebase.test.json --only firestore --project demo-jal-audit \
//     "node --test tests/integration/certificados.rules.test.cjs"
const { test, before, after } = require('node:test');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const {
  doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch, serverTimestamp,
} = require('firebase/firestore');

let env;
const sufijo = randomUUID().slice(0, 8);
const edil = `edil-${sufijo}`;
const joven = `joven-${sufijo}`;
const otro = `otro-${sufijo}`;
const PERFILES = {
  [joven]: { nombre: 'Ana', primer_apellido: 'Diaz', segundo_apellido: 'Ruiz', numero_documento: '12345678' },
  [otro]:  { nombre: 'Luis', primer_apellido: 'Perez', segundo_apellido: 'Gomez', numero_documento: '87654321' },
};
const nombreDe = (uid) => `${PERFILES[uid].nombre} ${PERFILES[uid].primer_apellido} ${PERFILES[uid].segundo_apellido}`;

/** 'AAAA-MM-DD' de hace `anios` años (día UTC, igual que request.time), corrido `dias` días. */
function haceAnios(anios, dias = 0) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function certificado(uid, extra = {}) {
  return {
    uid_estudiante: uid, nombre_estudiante: nombreDe(uid), numero_documento: PERFILES[uid].numero_documento,
    actividad: 'Apoyo biblioteca', entidad: 'JAL Comuna 3', horas_reportadas: 20, horas_aprobadas: 0,
    estado: 'Pendiente', motivo_rechazo: null, revertido: false, version: 1,
    archivo_nombre: 'cert.pdf', archivo_tipo: 'application/pdf', archivo_tamano: 2000, archivo_partes: 1,
    fecha_nacimiento: haceAnios(25), es_menor: false, consentimiento_joven: true,
    terminos_menor_aceptados: false, fecha_aceptacion_terminos: null, acudiente_nombre: null,
    fecha_carga: serverTimestamp(), fecha_revision: null, uid_revisor: null,
    ...extra,
  };
}

const parte = (uid, certId, version = 1) => ({ uid_estudiante: uid, certificado_id: certId, version, parte: 0, datos: 'JVBERi0xLjQ=' });

/** HU01: el certificado y su archivo se escriben en el mismo lote, como CertificadoModel.registrar. */
function crear(db, uid, certId, extra = {}) {
  const lote = writeBatch(db);
  lote.set(doc(db, 'certificados', certId), certificado(uid, extra));
  lote.set(doc(db, 'certificados_archivos', `${certId}_v1_0`), parte(uid, certId));
  return lote.commit();
}

const menor = (extra = {}) => ({
  fecha_nacimiento: haceAnios(15), es_menor: true, terminos_menor_aceptados: true,
  fecha_aceptacion_terminos: serverTimestamp(), acudiente_nombre: 'Rosa Ruiz', ...extra,
});

const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const revision = (cambios) => ({ ...cambios, fecha_revision: serverTimestamp(), uid_revisor: edil });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-jal-audit',
    firestore: { host: '127.0.0.1', port: 8088, rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const base = { email: 'x@example.test', tipo_documento: 'CC', ciudad_documento: 'Medellin' };
    await setDoc(doc(db, 'users', edil), { ...base, uid: edil, ...PERFILES[joven], numero_documento: '11111111', rol: 'edil' });
    for (const uid of [joven, otro]) await setDoc(doc(db, 'users', uid), { ...base, uid, ...PERFILES[uid], rol: 'estudiante' });
  });
});
after(async () => env?.cleanup());

test('HU01: un mayor de edad registra su certificado Pendiente con el archivo en el mismo lote', async () => {
  await assertSucceeds(crear(dbDe(joven), joven, `mayor-${sufijo}`));
  // Sin el archivo no queda un certificado Pendiente vacío.
  await assertFails(setDoc(doc(dbDe(joven), 'certificados', `sin-archivo-${sufijo}`), certificado(joven)));
  // Ni con horas, ni a nombre de otro joven.
  await assertFails(crear(dbDe(joven), joven, `con-horas-${sufijo}`, { horas_aprobadas: 5 }));
  await assertFails(crear(dbDe(joven), joven, `suplantado-${sufijo}`, { nombre_estudiante: nombreDe(otro) }));
});

test('HU01: la minoría de edad se deriva de la fecha; un menor no puede declararse mayor', async () => {
  const db = dbDe(joven);
  await assertFails(crear(db, joven, `menor-como-mayor-${sufijo}`, { fecha_nacimiento: haceAnios(15) }));
  await assertFails(crear(db, joven, `mayor-como-menor-${sufijo}`, menor({ fecha_nacimiento: haceAnios(25) })));
});

test('HU01: un menor necesita nombrar a su tutor y aceptar los términos', async () => {
  const db = dbDe(joven);
  await assertFails(crear(db, joven, `menor-sin-terminos-${sufijo}`, menor({ terminos_menor_aceptados: false, fecha_aceptacion_terminos: null })));
  await assertFails(crear(db, joven, `menor-sin-tutor-${sufijo}`, menor({ acudiente_nombre: null })));
  await assertFails(crear(db, joven, `menor-sin-constancia-${sufijo}`, menor({ fecha_aceptacion_terminos: null })));
  await assertSucceeds(crear(db, joven, `menor-ok-${sufijo}`, menor()));
});

test('HU01: cumple 18 el día de su cumpleaños; fechas futuras o mal formadas se rechazan', async () => {
  const db = dbDe(joven);
  await assertSucceeds(crear(db, joven, `cumple-hoy-${sufijo}`, { fecha_nacimiento: haceAnios(18) }));
  await assertFails(crear(db, joven, `cumple-manana-${sufijo}`, { fecha_nacimiento: haceAnios(18, 1) }));
  for (const [i, fecha] of [haceAnios(-1), '2008-13-01', '10/05/2008', '1899-12-31'].entries()) {
    await assertFails(crear(db, joven, `fecha-mala-${i}-${sufijo}`, { fecha_nacimiento: fecha }));
  }
});

test('HU02/HU06: solo el dueño y el edil leen el certificado y su archivo', async () => {
  const id = `mayor-${sufijo}`;
  await assertSucceeds(getDoc(doc(dbDe(joven), 'certificados', id)));
  await assertSucceeds(getDoc(doc(dbDe(joven), 'certificados_archivos', `${id}_v1_0`)));
  await assertSucceeds(getDoc(doc(dbDe(edil), 'certificados_archivos', `${id}_v1_0`)));
  await assertFails(getDoc(doc(dbDe(otro), 'certificados', id)));
  await assertFails(getDoc(doc(dbDe(otro), 'certificados_archivos', `${id}_v1_0`)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'certificados', id)));
  // Nadie enumera archivos, y un joven solo lista sus propios certificados.
  await assertFails(getDocs(collection(dbDe(edil), 'certificados_archivos')));
  await assertFails(getDocs(collection(dbDe(otro), 'certificados')));
  await assertSucceeds(getDocs(query(collection(dbDe(otro), 'certificados'), where('uid_estudiante', '==', otro))));
});

test('HU02: solo el edil aprueba, sin superar las horas reportadas', async () => {
  const ref = (db) => doc(db, 'certificados', `mayor-${sufijo}`);
  await assertFails(updateDoc(ref(dbDe(joven)), { estado: 'Aprobado', horas_aprobadas: 20, fecha_revision: serverTimestamp(), uid_revisor: joven }));
  await assertFails(updateDoc(ref(dbDe(edil)), revision({ estado: 'Aprobado', horas_aprobadas: 25 })));
  await assertSucceeds(updateDoc(ref(dbDe(edil)), revision({ estado: 'Aprobado', horas_aprobadas: 18 })));
  // Aprobar dos veces no vuelve a sumar: el estado previo ya no es Pendiente.
  await assertFails(updateDoc(ref(dbDe(edil)), revision({ estado: 'Aprobado', horas_aprobadas: 18 })));
});

test('HU04: revertir exige motivo, deja 0 horas y no se repite', async () => {
  const ref = doc(dbDe(edil), 'certificados', `mayor-${sufijo}`);
  const revertir = (motivo) => updateDoc(ref, revision({ estado: 'Rechazado', horas_aprobadas: 0, revertido: true, motivo_rechazo: motivo }));
  await assertFails(revertir(''));
  await assertFails(updateDoc(ref, revision({ estado: 'Rechazado', horas_aprobadas: 10, revertido: true, motivo_rechazo: 'Error' })));
  await assertSucceeds(revertir('Aprobación por error'));
  await assertFails(revertir('Segundo intento'));
});

test('HU03: solo el dueño corrige un Rechazado; vuelve a Pendiente con 0 horas', async () => {
  const id = `mayor-${sufijo}`;
  const correccion = (db, uid) => {
    const lote = writeBatch(db);
    lote.update(doc(db, 'certificados', id), {
      estado: 'Pendiente', version: 2, archivo_nombre: 'cert-v2.pdf', archivo_tipo: 'application/pdf',
      archivo_tamano: 2100, archivo_partes: 1, motivo_rechazo: null, revertido: false,
      fecha_carga: serverTimestamp(), fecha_revision: null, uid_revisor: null,
    });
    lote.set(doc(db, 'certificados_archivos', `${id}_v2_0`), parte(uid, id, 2));
    return lote.commit();
  };
  await assertFails(correccion(dbDe(otro), otro));
  await assertSucceeds(correccion(dbDe(joven), joven));
  const snap = await getDoc(doc(dbDe(joven), 'certificados', id));
  if (snap.data().estado !== 'Pendiente' || snap.data().horas_aprobadas !== 0) throw new Error('la corrección no quedó Pendiente con 0 horas');
  // Un Pendiente no se puede volver a "corregir".
  await assertFails(correccion(dbDe(joven), joven));
});

test('HU06: nadie borra certificados desde el cliente y la eliminación solo se pide para uno mismo', async () => {
  await assertFails(deleteDoc(doc(dbDe(joven), 'certificados', `mayor-${sufijo}`)));
  await assertFails(deleteDoc(doc(dbDe(edil), 'certificados', `mayor-${sufijo}`)));
  const solicitud = (uid, extra = {}) => ({
    uid_estudiante: uid, nombre_estudiante: nombreDe(uid), numero_documento: PERFILES[uid].numero_documento,
    motivo: null, estado: 'Recibida', fecha_solicitud: serverTimestamp(), ...extra,
  });
  await assertFails(setDoc(doc(dbDe(otro), 'solicitudes_eliminacion', `ajena-${sufijo}`), solicitud(joven)));
  await assertFails(setDoc(doc(dbDe(joven), 'solicitudes_eliminacion', `borrada-${sufijo}`), solicitud(joven, { estado: 'Eliminada' })));
  await assertSucceeds(setDoc(doc(dbDe(joven), 'solicitudes_eliminacion', `propia-${sufijo}`), solicitud(joven)));
  await assertFails(getDoc(doc(dbDe(otro), 'solicitudes_eliminacion', `propia-${sufijo}`)));
  await assertSucceeds(getDoc(doc(dbDe(edil), 'solicitudes_eliminacion', `propia-${sufijo}`)));
});
