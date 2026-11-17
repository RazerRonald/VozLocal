/**
 * @fileoverview CertificadoModel — Certificados de servicio social (E04 / SC-001).
 * Habla únicamente con Firestore. No toca el DOM.
 *
 * Colección `certificados`: metadatos, estado y horas. El archivo se guarda en
 * `certificados_archivos/{certId}_v{version}_{n}` como trozos base64 privados
 * (dueño o Edil), escritos en el mismo lote que el certificado.
 *
 * @module models/CertificadoModel
 */

import { db } from '../config/firebase.config.js';
import {
  COL_CERTIFICADOS,
  COL_CERTIFICADOS_ARCHIVOS,
  ESTADOS_CERTIFICADO,
} from '../config/collections.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const parteId = (certId, version, n) => `${certId}_v${version}_${n}`;
const fechaMs = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

const CertificadoModel = {
  /**
   * HU01: crea el certificado Pendiente y su archivo en un solo lote atómico.
   * @param {Object} datos   Identidad, actividad, horas, archivo_* y consentimientos.
   * @param {string[]} partes Trozos base64 del archivo.
   * @returns {Promise<string>} ID del certificado.
   */
  async registrar(datos, partes) {
    const ref = doc(collection(db, COL_CERTIFICADOS));
    const batch = writeBatch(db);
    batch.set(ref, {
      ...datos,
      estado:          ESTADOS_CERTIFICADO.PENDIENTE,
      horas_aprobadas: 0,
      motivo_rechazo:  null,
      revertido:       false,
      version:         1,
      archivo_partes:  partes.length,
      fecha_carga:     serverTimestamp(),
      fecha_revision:  null,
      uid_revisor:     null,
    });
    this._agregarPartes(batch, ref.id, 1, datos.uid_estudiante, partes);
    await batch.commit();
    return ref.id;
  },

  /**
   * HU03: nueva versión de un certificado Rechazado; vuelve a Pendiente.
   * Las versiones anteriores del archivo se conservan (historial por definir).
   */
  async corregir(certificado, datos, partes) {
    const version = certificado.version + 1;
    const batch = writeBatch(db);
    batch.update(doc(db, COL_CERTIFICADOS, certificado.id), {
      ...datos,
      estado:         ESTADOS_CERTIFICADO.PENDIENTE,
      version,
      archivo_partes: partes.length,
      motivo_rechazo: null,
      revertido:      false,
      fecha_carga:    serverTimestamp(),
      fecha_revision: null,
      uid_revisor:    null,
    });
    this._agregarPartes(batch, certificado.id, version, certificado.uid_estudiante, partes);
    await batch.commit();
  },

  _agregarPartes(batch, certId, version, uid, partes) {
    partes.forEach((datos, parte) => {
      batch.set(doc(db, COL_CERTIFICADOS_ARCHIVOS, parteId(certId, version, parte)), {
        uid_estudiante: uid,
        certificado_id: certId,
        version,
        parte,
        datos,
      });
    });
  },

  /** HU05: certificados propios, del más reciente al más antiguo. */
  async listarPropios(uid) {
    const snap = await getDocs(query(collection(db, COL_CERTIFICADOS), where('uid_estudiante', '==', uid)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => fechaMs(b.fecha_carga) - fechaMs(a.fecha_carga));
  },

  /** HU02: todos los certificados (solo Edil por reglas). */
  async listarTodos() {
    const snap = await getDocs(query(collection(db, COL_CERTIFICADOS), orderBy('fecha_carga', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /** Reconstruye el base64 de la versión vigente del archivo. */
  async leerArchivo(certificado) {
    const snaps = await Promise.all(
      Array.from({ length: certificado.archivo_partes }, (_, n) =>
        getDoc(doc(db, COL_CERTIFICADOS_ARCHIVOS, parteId(certificado.id, certificado.version, n)))),
    );
    if (snaps.some((s) => !s.exists())) throw Object.assign(new Error('archivo incompleto'), { code: 'certificado/archivo-incompleto' });
    return snaps.map((s) => s.data().datos).join('');
  },

  aprobar(certId, horas, uidRevisor) {
    return this._revisar(certId, ESTADOS_CERTIFICADO.PENDIENTE, {
      estado:          ESTADOS_CERTIFICADO.APROBADO,
      horas_aprobadas: horas,
    }, uidRevisor);
  },

  rechazar(certId, motivo, uidRevisor) {
    return this._revisar(certId, ESTADOS_CERTIFICADO.PENDIENTE, {
      estado:         ESTADOS_CERTIFICADO.RECHAZADO,
      motivo_rechazo: motivo,
    }, uidRevisor);
  },

  /** HU04: descuenta exactamente las horas de este certificado (quedan en 0). */
  revertir(certId, motivo, uidRevisor) {
    return this._revisar(certId, ESTADOS_CERTIFICADO.APROBADO, {
      estado:          ESTADOS_CERTIFICADO.RECHAZADO,
      horas_aprobadas: 0,
      revertido:       true,
      motivo_rechazo:  motivo,
    }, uidRevisor);
  },

  /**
   * La transacción relee el estado: un segundo intento (o uno concurrente)
   * falla en vez de volver a aplicar el cambio.
   */
  async _revisar(certId, estadoEsperado, cambios, uidRevisor) {
    const ref = doc(db, COL_CERTIFICADOS, certId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists() || snap.data().estado !== estadoEsperado) {
        throw Object.assign(new Error('estado cambiado'), { code: 'certificado/estado-cambiado' });
      }
      tx.update(ref, { ...cambios, fecha_revision: serverTimestamp(), uid_revisor: uidRevisor });
    });
  },
};

export default CertificadoModel;
