/**
 * @fileoverview CertificadosView — Vista del joven becado (#/certificados):
 * carga y corrección de certificados (E04 / SC-001).
 *
 * @module views/CertificadosView
 */

import CertificadoController from '../controllers/CertificadoController.js';
import AuthModel             from '../models/AuthModel.js';
import Toast                 from '../components/Toast.js';
import { i18n }              from '../config/i18n.js';
import { ESTADOS_CERTIFICADO } from '../config/collections.js';

const t = () => i18n.certificados;

const CertificadosView = {
  _certificados: [],
  /** Certificado Rechazado que se está corrigiendo (HU03), o null. */
  _corrigiendo: null,

  async render() {
    const root = document.getElementById('app-root');
    const sesion = AuthModel.getSesion();
    if (!root || !sesion) return;
    this._corrigiendo = null;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">${t().titulo}</li>
            </ol>
          </nav>
          <h1><i class="bi bi-patch-check me-2"></i>${t().titulo}</h1>
          <p class="page-hero-sub mb-0">${t().subtitulo}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="row g-4">
          <div class="col-lg-5">
            <section class="form-jal" aria-labelledby="cert-form-titulo">
              <h2 class="h5 fw-700 mb-3" id="cert-form-titulo">
                <i class="bi bi-cloud-arrow-up text-primary me-2"></i><span id="cert-form-titulo-texto">${t().cargarTitulo}</span>
              </h2>
              ${this._buildFormulario()}
            </section>
          </div>
          <div class="col-lg-7">
            <section class="form-jal p-0 overflow-hidden" aria-labelledby="cert-listado-titulo">
              <h2 class="h5 fw-700 mb-0 p-4 border-bottom" id="cert-listado-titulo">
                <i class="bi bi-list-check text-primary me-2"></i>${t().listado}
              </h2>
              <div id="cert-listado" class="list-group list-group-flush"></div>
            </section>
          </div>
        </div>
      </div>
    `;

    this._bindFormulario();
    await this._cargar();
  },

  async _cargar() {
    await CertificadoController.obtenerMios({
      onSuccess: ({ certificados }) => {
        this._certificados = certificados;
        this._renderListado(certificados);
      },
      onError: (msg) => {
        const listado = document.getElementById('cert-listado');
        if (listado) listado.innerHTML = `<div class="alert alert-warning m-4">${this._esc(msg)}</div>`;
      },
    });
  },

  _renderListado(certificados) {
    const el = document.getElementById('cert-listado');
    if (!el) return;
    if (!certificados.length) {
      el.innerHTML = `<p class="text-muted p-4 mb-0"><i class="bi bi-inbox me-2"></i>${t().sinCertificados}</p>`;
      return;
    }
    el.innerHTML = certificados.map((c) => `
      <div class="list-group-item p-4" data-id="${this._esc(c.id)}">
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div class="me-auto">
            <div class="fw-600">${this._esc(c.actividad)}</div>
            <div class="small text-muted">${this._esc(c.entidad)} · ${this._formatFecha(c.fecha_carga)}</div>
          </div>
          ${this._buildEstado(c.estado)}
        </div>
        <div class="small mt-2">
          <strong>${c.estado === ESTADOS_CERTIFICADO.APROBADO ? c.horas_aprobadas : 0}</strong> ${t().horasAprobadas}
          <span class="text-muted">(${c.horas_reportadas} ${t().horasReportadas})</span>
        </div>
        ${c.estado === ESTADOS_CERTIFICADO.RECHAZADO && c.motivo_rechazo ? `
          <div class="alert alert-danger small py-2 mt-2 mb-0">
            ${c.revertido ? `<strong>${t().revertidoNota}.</strong> ` : ''}<strong>${t().motivo}:</strong> ${this._esc(c.motivo_rechazo)}
          </div>` : ''}
        <div class="d-flex gap-2 flex-wrap mt-3">
          <button type="button" class="btn btn-sm btn-outline-primary btn-cert-ver" data-id="${this._esc(c.id)}">
            <i class="bi bi-file-earmark-arrow-down me-1"></i>${t().verArchivo}
          </button>
          ${c.estado === ESTADOS_CERTIFICADO.RECHAZADO ? `
            <button type="button" class="btn btn-sm btn-outline-warning btn-cert-corregir" data-id="${this._esc(c.id)}">
              <i class="bi bi-arrow-repeat me-1"></i>${t().corregir}
            </button>` : ''}
        </div>
      </div>
    `).join('');

    el.onclick = (event) => {
      const btn = event.target.closest('button[data-id]');
      const cert = btn && this._certificados.find((c) => c.id === btn.dataset.id);
      if (!cert) return;
      if (btn.classList.contains('btn-cert-ver')) this._descargar(cert, btn);
      if (btn.classList.contains('btn-cert-corregir')) this._iniciarCorreccion(cert);
    };
  },

  _buildFormulario() {
    return `
      <form id="form-certificado" novalidate>
        <div class="mb-3">
          <label for="cert-actividad" class="form-label">${t().campoActividad} *</label>
          <input type="text" id="cert-actividad" name="actividad" class="form-control" required maxlength="200" />
        </div>
        <div class="mb-3">
          <label for="cert-entidad" class="form-label">${t().campoEntidad} *</label>
          <input type="text" id="cert-entidad" name="entidad" class="form-control" required maxlength="200" />
        </div>
        <div class="mb-3">
          <label for="cert-horas" class="form-label">${t().campoHoras} *</label>
          <input type="number" id="cert-horas" name="horas_reportadas" class="form-control" required min="0.5" max="1000" step="0.5" inputmode="decimal" />
        </div>
        <div class="mb-3">
          <label for="cert-archivo" class="form-label">${t().campoArchivo} *</label>
          <input type="file" id="cert-archivo" class="form-control" required
                 accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-describedby="cert-archivo-ayuda" />
          <div id="cert-archivo-ayuda" class="form-text">${t().ayudaArchivo}</div>
        </div>

        <fieldset id="cert-consentimientos" class="mb-3">
          <legend class="form-label fs-6 fw-600">Consentimientos</legend>
          <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" id="cert-consentimiento-joven" name="consentimiento_joven" />
            <label class="form-check-label small" for="cert-consentimiento-joven">${t().consentimientoJoven} *</label>
          </div>
          <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" id="cert-es-menor" name="es_menor" aria-controls="cert-bloque-acudiente" aria-expanded="false" />
            <label class="form-check-label small" for="cert-es-menor">${t().esMenor}</label>
          </div>
          <div id="cert-bloque-acudiente" class="border rounded p-3 d-none">
            <label for="cert-acudiente-nombre" class="form-label small">${t().acudienteNombre} *</label>
            <input type="text" id="cert-acudiente-nombre" name="acudiente_nombre" class="form-control mb-2" maxlength="120" />
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="cert-consentimiento-acudiente" name="consentimiento_acudiente" />
              <label class="form-check-label small" for="cert-consentimiento-acudiente">${t().consentimientoAcudiente} *</label>
            </div>
          </div>
        </fieldset>

        <div id="cert-progreso" class="d-none mb-3 small text-muted" role="status">
          <span class="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true"></span>${t().cargando}
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button type="submit" class="btn-jal-primary d-inline-flex align-items-center gap-2" id="btn-cert-enviar">
            <i class="bi bi-send" aria-hidden="true"></i><span id="btn-cert-enviar-texto">${t().enviar}</span>
          </button>
          <button type="button" class="btn-jal-secondary d-none" id="btn-cert-cancelar-correccion">${i18n.app.cancelar}</button>
        </div>
      </form>
    `;
  },

  _bindFormulario() {
    const form = document.getElementById('form-certificado');
    const esMenor = document.getElementById('cert-es-menor');
    esMenor?.addEventListener('change', () => {
      document.getElementById('cert-bloque-acudiente')?.classList.toggle('d-none', !esMenor.checked);
      esMenor.setAttribute('aria-expanded', String(esMenor.checked));
    });
    document.getElementById('btn-cert-cancelar-correccion')?.addEventListener('click', () => this._salirCorreccion());
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this._enviar(form);
    });
  },

  async _enviar(form) {
    const formData = Object.fromEntries(new FormData(form).entries());
    const archivo = document.getElementById('cert-archivo')?.files?.[0] || null;
    const callbacks = {
      onLoading: (cargando) => {
        document.getElementById('cert-progreso')?.classList.toggle('d-none', !cargando);
        const btn = document.getElementById('btn-cert-enviar');
        if (btn) btn.disabled = cargando;
      },
      onSuccess: () => {
        Toast.exito(this._corrigiendo ? t().corregidoOk : t().cargadoOk);
        this._salirCorreccion();
        this._cargar();
      },
      onError: (msg) => Toast.error(msg),
    };

    if (this._corrigiendo) await CertificadoController.corregir(this._corrigiendo, formData, archivo, callbacks);
    else await CertificadoController.cargar(formData, archivo, callbacks);
  },

  /** HU03: reutiliza el formulario; los consentimientos ya otorgados se conservan. */
  _iniciarCorreccion(cert) {
    this._corrigiendo = cert;
    document.getElementById('cert-actividad').value = cert.actividad;
    document.getElementById('cert-entidad').value = cert.entidad;
    document.getElementById('cert-horas').value = cert.horas_reportadas;
    document.getElementById('cert-archivo').value = '';
    document.getElementById('cert-consentimientos')?.classList.add('d-none');
    document.getElementById('cert-form-titulo-texto').textContent = t().corregirTitulo;
    document.getElementById('btn-cert-enviar-texto').textContent = t().enviarCorreccion;
    document.getElementById('btn-cert-cancelar-correccion')?.classList.remove('d-none');
    document.getElementById('cert-archivo')?.focus();
  },

  _salirCorreccion() {
    this._corrigiendo = null;
    document.getElementById('form-certificado')?.reset();
    document.getElementById('cert-bloque-acudiente')?.classList.add('d-none');
    document.getElementById('cert-es-menor')?.setAttribute('aria-expanded', 'false');
    document.getElementById('cert-consentimientos')?.classList.remove('d-none');
    const titulo = document.getElementById('cert-form-titulo-texto');
    if (titulo) titulo.textContent = t().cargarTitulo;
    const texto = document.getElementById('btn-cert-enviar-texto');
    if (texto) texto.textContent = t().enviar;
    document.getElementById('btn-cert-cancelar-correccion')?.classList.add('d-none');
  },

  async _descargar(cert, btn) {
    btn.disabled = true;
    try {
      const blob = await CertificadoController.obtenerArchivo(cert);
      const url = URL.createObjectURL(blob);
      const enlace = Object.assign(document.createElement('a'), { href: url, download: cert.archivo_nombre });
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('[CertificadosView._descargar]', err);
      Toast.error(CertificadoController._mensajeError(err));
    } finally {
      btn.disabled = false;
    }
  },

  _buildEstado(estado) {
    const clase = {
      [ESTADOS_CERTIFICADO.PENDIENTE]: 'bg-warning-subtle text-warning-emphasis',
      [ESTADOS_CERTIFICADO.APROBADO]:  'bg-success-subtle text-success-emphasis',
      [ESTADOS_CERTIFICADO.RECHAZADO]: 'bg-danger-subtle text-danger-emphasis',
    }[estado] || 'bg-secondary-subtle';
    return `<span class="badge ${clase}">${this._esc(t().estados[estado] || estado)}</span>`;
  },

  _formatFecha(ts) {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  },

  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};

export default CertificadosView;
