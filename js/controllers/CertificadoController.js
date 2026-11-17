/**
 * @fileoverview CertificadoController — Orquesta certificados de servicio social
 * (E04 / SC-001): valida formulario y archivo, y delega en CertificadoModel.
 *
 * @module controllers/CertificadoController
 */

import CertificadoModel  from '../models/CertificadoModel.js';
import AuthModel         from '../models/AuthModel.js';
import ArchivoController from './ArchivoController.js';
import { META_HORAS_SERVICIO } from '../config/collections.js';
import { i18n }          from '../config/i18n.js';
import {
  validarArchivoCertificado,
  bytesABase64,
  base64ABytes,
  partirEnTrozos,
  calcularAvance,
} from '../utils/certificados.js';

const t = () => i18n.certificados;

const CertificadoController = {
  /** HU05: certificados propios, avance hacia la meta y constancias de eliminación. */
  async obtenerMios({ onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    if (!sesion) return onError(i18n.auth.accesoDenegado);
    try {
      const [certificados, solicitudes] = await Promise.all([
        CertificadoModel.listarPropios(sesion.uid),
        CertificadoModel.listarSolicitudesEliminacionPropias(sesion.uid),
      ]);
      onSuccess({ certificados, solicitudes, avance: calcularAvance(certificados, META_HORAS_SERVICIO) });
    } catch (err) {
      console.error('[CertificadoController.obtenerMios]', err);
      onError(this._mensajeError(err));
    }
  },

  /** HU01: valida y registra un certificado nuevo. */
  async cargar(formData, archivo, { onLoading, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    if (!sesion) return onError(i18n.auth.accesoDenegado);

    const datos = this._datosFormulario(formData);
    const error = this._validarDatos(datos) || this._validarConsentimientos(datos);
    if (error) return onError(error);

    onLoading(true);
    try {
      const archivoListo = await this._prepararArchivo(archivo);
      if (archivoListo.error) return onError(archivoListo.error);

      const perfil = ArchivoController._datosPerfilSesion(sesion);
      await CertificadoModel.registrar({
        uid_estudiante:    sesion.uid,
        nombre_estudiante: perfil.nombre_completo,
        numero_documento:  perfil.numero_documento,
        ...datos,
        ...archivoListo.metadatos,
      }, archivoListo.partes);
      onSuccess();
    } catch (err) {
      console.error('[CertificadoController.cargar]', err);
      onError(this._mensajeError(err));
    } finally {
      onLoading(false);
    }
  },

  /** HU06: el archivo solo se entrega como Blob local, nunca como URL pública. */
  async obtenerArchivo(certificado) {
    const base64 = await CertificadoModel.leerArchivo(certificado);
    return new Blob([base64ABytes(base64)], { type: certificado.archivo_tipo });
  },

  /** HU06: constancia de solicitud de eliminación (no borra datos). */
  async solicitarEliminacion(motivo, { onLoading, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    if (!sesion) return onError(i18n.auth.accesoDenegado);
    onLoading(true);
    try {
      const perfil = ArchivoController._datosPerfilSesion(sesion);
      const id = await CertificadoModel.solicitarEliminacion({
        uid_estudiante:    sesion.uid,
        nombre_estudiante: perfil.nombre_completo,
        numero_documento:  perfil.numero_documento,
        motivo:            this._texto(motivo, 500) || null,
      });
      onSuccess(id);
    } catch (err) {
      console.error('[CertificadoController.solicitarEliminacion]', err);
      onError(this._mensajeError(err));
    } finally {
      onLoading(false);
    }
  },

  // ─── Revisor (Edil) ──────────────────────────────────────────────────

  async listarTodos({ onSuccess, onError }) {
    try {
      const [certificados, solicitudes] = await Promise.all([
        CertificadoModel.listarTodos(),
        CertificadoModel.listarSolicitudesEliminacion(),
      ]);
      onSuccess({ certificados, solicitudes });
    } catch (err) {
      console.error('[CertificadoController.listarTodos]', err);
      onError(this._mensajeError(err));
    }
  },

  /** HU02: aprueba con horas verificadas (0 < horas <= reportadas). */
  aprobar(certificado, horasTexto, callbacks) {
    const horas = Number(horasTexto);
    if (!Number.isFinite(horas) || horas <= 0 || horas > certificado.horas_reportadas) {
      return callbacks.onError(t().errorHorasVerificadas.replace('{max}', certificado.horas_reportadas));
    }
    return this._revisar(callbacks, (uid) => CertificadoModel.aprobar(certificado.id, horas, uid));
  },

  rechazar(certificado, motivo, callbacks) {
    const texto = this._texto(motivo, 1000);
    if (!texto) return callbacks.onError(t().errorMotivo);
    return this._revisar(callbacks, (uid) => CertificadoModel.rechazar(certificado.id, texto, uid));
  },

  async _revisar({ onLoading, onSuccess, onError }, accion) {
    const sesion = AuthModel.getSesion();
    if (!sesion) return onError(i18n.auth.accesoDenegado);
    onLoading(true);
    try {
      await accion(sesion.uid);
      onSuccess();
    } catch (err) {
      console.error('[CertificadoController._revisar]', err);
      onError(this._mensajeError(err));
    } finally {
      onLoading(false);
    }
  },

  // ─── Validación ──────────────────────────────────────────────────────

  _datosFormulario(formData) {
    const esMenor = formData.es_menor === 'on';
    return {
      actividad:                this._texto(formData.actividad, 200),
      entidad:                  this._texto(formData.entidad, 200),
      horas_reportadas:         Number(formData.horas_reportadas),
      es_menor:                 esMenor,
      consentimiento_joven:     formData.consentimiento_joven === 'on',
      consentimiento_acudiente: esMenor && formData.consentimiento_acudiente === 'on',
      acudiente_nombre:         esMenor ? (this._texto(formData.acudiente_nombre, 120) || null) : null,
    };
  },

  _validarDatos({ actividad, entidad, horas_reportadas }) {
    if (!actividad || !entidad) return t().errorCampos;
    if (!Number.isFinite(horas_reportadas) || horas_reportadas <= 0 || horas_reportadas > 1000) return t().errorHoras;
    return null;
  },

  _validarConsentimientos(datos) {
    if (!datos.consentimiento_joven) return t().errorConsentimientoJoven;
    if (datos.es_menor && (!datos.consentimiento_acudiente || !datos.acudiente_nombre)) return t().errorConsentimientoAcudiente;
    return null;
  },

  /** HU01 criterios 3 y 4: formato, tamaño e integridad antes de escribir nada. */
  async _prepararArchivo(archivo) {
    if (!archivo) return { error: t().errorArchivoRequerido };
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const resultado = validarArchivoCertificado(bytes);
    if (!resultado.ok) return { error: t().erroresArchivo[resultado.error] };
    if (!(await this._imagenLegible(bytes, resultado.tipo))) return { error: t().erroresArchivo.corrupto };

    return {
      partes: partirEnTrozos(bytesABase64(bytes)),
      metadatos: {
        archivo_nombre: this._texto(archivo.name, 200) || 'certificado',
        archivo_tipo:   resultado.tipo,
        archivo_tamano: bytes.length,
      },
    };
  },

  /** Una imagen con firma válida pero datos dañados no se puede decodificar. */
  async _imagenLegible(bytes, tipo) {
    if (!tipo.startsWith('image/') || typeof createImageBitmap !== 'function') return true;
    try {
      const imagen = await createImageBitmap(new Blob([bytes], { type: tipo }));
      imagen.close?.();
      return true;
    } catch (_) {
      return false; // el navegador no pudo decodificarla: es la señal de archivo corrupto
    }
  },

  _texto(valor, max) {
    return String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  },

  _mensajeError(err) {
    if (err?.code === 'certificado/estado-cambiado') return t().errorEstadoCambiado;
    if (err?.code === 'certificado/archivo-incompleto') return t().erroresArchivo.corrupto;
    if (err?.code === 'permission-denied') return t().errorPermiso;
    return i18n.app.errorGenerico;
  },
};

export default CertificadoController;
