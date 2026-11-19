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
import { esMenorDeEdad, hoyIso } from '../utils/certificados.js';
import { sinEsperar } from '../utils/promesas.js';

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
        <section id="cert-avance" class="form-jal mb-4" aria-labelledby="cert-avance-titulo" aria-live="polite">
          <div class="text-muted"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${i18n.app.cargando}</div>
        </section>

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

        <section class="form-jal mt-4" aria-labelledby="cert-eliminacion-titulo">
          <h2 class="h5 fw-700 mb-2" id="cert-eliminacion-titulo">
            <i class="bi bi-shield-lock text-primary me-2"></i>${t().eliminacionTitulo}
          </h2>
          <p class="text-muted small mb-3">${t().eliminacionTexto}</p>
          <div id="cert-eliminacion-estado"></div>
          <label for="cert-eliminacion-motivo" class="form-label">${t().eliminacionMotivo}</label>
          <textarea id="cert-eliminacion-motivo" class="form-control mb-3" rows="2" maxlength="500"></textarea>
          <div id="cert-eliminacion-acciones"></div>
        </section>
      </div>
      ${this._buildModalTerminos()}
    `;

    this._bindFormulario();
    this._mostrarBotonEliminacion();
    await this._cargar();
  },

  async _cargar() {
    await CertificadoController.obtenerMios({
      onSuccess: ({ certificados, solicitudes, avance }) => {
        this._certificados = certificados;
        this._precargarFechaNacimiento();
        this._renderAvance(avance);
        this._renderListado(certificados);
        this._renderEliminacion(solicitudes);
      },
      onError: (msg) => {
        const avance = document.getElementById('cert-avance');
        if (avance) avance.innerHTML = `<div class="alert alert-warning mb-0">${this._esc(msg)}</div>`;
      },
    });
  },

  _renderAvance({ horas, meta, faltan, cumplida, porcentaje }) {
    const el = document.getElementById('cert-avance');
    if (!el) return;
    el.innerHTML = `
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <h2 class="h5 fw-700 mb-0" id="cert-avance-titulo">
          <i class="bi bi-graph-up-arrow text-primary me-2"></i>${t().avanceTitulo}
        </h2>
        <span class="badge ${cumplida ? 'bg-success-subtle text-success-emphasis' : 'bg-warning-subtle text-warning-emphasis'}" id="cert-meta-estado">
          <i class="bi ${cumplida ? 'bi-check-circle' : 'bi-hourglass-split'} me-1" aria-hidden="true"></i>${cumplida ? t().metaCumplida : t().metaPendiente}
        </span>
      </div>
      <p class="mb-2">
        <span class="display-6 fw-700" id="cert-horas-total">${horas}</span>
        <span class="text-muted">/ ${meta} ${t().horasAprobadas}</span>
      </p>
      <div class="progress mb-2" role="progressbar" aria-label="${t().horasAprobadas}"
           aria-valuenow="${horas}" aria-valuemin="0" aria-valuemax="${meta}" style="height:12px;">
        <div class="progress-bar ${cumplida ? 'bg-success' : ''}" style="width:${porcentaje}%"></div>
      </div>
      <p class="small text-muted mb-0">
        ${cumplida ? '' : this._esc(t().faltan.replace('{n}', faltan).replace('{meta}', meta)) + ' '}${t().soloAprobadas}
      </p>
    `;
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
      if (btn.classList.contains('btn-cert-ver')) sinEsperar(this._descargar(cert, btn), 'CertificadosView._descargar');
      if (btn.classList.contains('btn-cert-corregir')) this._iniciarCorreccion(cert);
    };
  },

  /** Solo actualiza el aviso: recargar la lista no debe borrar el motivo que se está escribiendo. */
  _renderEliminacion(solicitudes) {
    const el = document.getElementById('cert-eliminacion-estado');
    if (!el) return;
    const ultima = solicitudes[0];
    el.innerHTML = ultima ? `
      <div class="alert alert-info small" role="status">
        ${this._esc(t().eliminacionRegistrada.replace('{fecha}', this._formatFecha(ultima.fecha_solicitud)).replace('{estado}', ultima.estado))}
      </div>` : '';
  },

  _mostrarBotonEliminacion() {
    const acciones = document.getElementById('cert-eliminacion-acciones');
    if (!acciones) return;
    acciones.innerHTML = `
      <button type="button" class="btn btn-outline-danger" id="btn-cert-eliminacion">
        <i class="bi bi-trash3 me-1"></i>${t().eliminacionBoton}
      </button>
    `;
    document.getElementById('btn-cert-eliminacion')?.addEventListener('click', () => this._confirmarEliminacion());
  },

  /** Confirmación en línea: dos pasos y sin modal, usable con teclado. */
  _confirmarEliminacion() {
    const acciones = document.getElementById('cert-eliminacion-acciones');
    if (!acciones) return;
    acciones.innerHTML = `
      <div class="alert alert-warning d-flex flex-wrap align-items-center gap-2 mb-0" role="alert">
        <span class="me-auto">${t().eliminacionConfirmar}</span>
        <button type="button" class="btn btn-sm btn-secondary" id="btn-cert-eliminacion-cancelar">${i18n.app.cancelar}</button>
        <button type="button" class="btn btn-sm btn-danger" id="btn-cert-eliminacion-confirmar">${i18n.app.confirmar}</button>
      </div>
    `;
    const confirmar = document.getElementById('btn-cert-eliminacion-confirmar');
    confirmar?.focus();
    document.getElementById('btn-cert-eliminacion-cancelar')?.addEventListener('click', () => this._mostrarBotonEliminacion());
    confirmar?.addEventListener('click', () => {
      const motivo = document.getElementById('cert-eliminacion-motivo');
      sinEsperar(CertificadoController.solicitarEliminacion(motivo?.value, {
        onLoading: (cargando) => { confirmar.disabled = cargando; },
        onSuccess: () => {
          Toast.exito(t().eliminacionOk);
          if (motivo) motivo.value = '';
          this._mostrarBotonEliminacion();
          sinEsperar(this._cargar(), 'CertificadosView._cargar');
        },
        onError: (msg) => Toast.error(msg),
      }), 'CertificadosView.solicitarEliminacion');
    });
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
          <div class="mb-3">
            <label for="cert-fecha-nacimiento" class="form-label small">${t().campoFechaNacimiento} *</label>
            <input type="date" id="cert-fecha-nacimiento" name="fecha_nacimiento" class="form-control" required
                   min="1900-01-01" max="${hoyIso()}" aria-describedby="cert-fecha-nacimiento-ayuda"
                   aria-controls="cert-bloque-menor" />
            <div id="cert-fecha-nacimiento-ayuda" class="form-text">${t().ayudaFechaNacimiento}</div>
          </div>
          <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" id="cert-consentimiento-joven" name="consentimiento_joven" />
            <label class="form-check-label small" for="cert-consentimiento-joven">${t().consentimientoJoven} *</label>
          </div>
          <div id="cert-bloque-menor" class="border rounded p-3 d-none" aria-live="polite">
            <p class="small fw-600 mb-2"><i class="bi bi-person-exclamation me-1" aria-hidden="true"></i>${t().avisoMenor}</p>
            <label for="cert-acudiente-nombre" class="form-label small">${t().acudienteNombre} *</label>
            <input type="text" id="cert-acudiente-nombre" name="acudiente_nombre" class="form-control mb-3" maxlength="120" autocomplete="off" />
            <input type="hidden" id="cert-terminos-menor" name="terminos_menor_aceptados" value="" />
            <div class="d-flex align-items-center flex-wrap gap-2">
              <button type="button" class="btn btn-sm btn-outline-primary" id="btn-cert-terminos"
                      aria-haspopup="dialog" aria-controls="modal-terminos-menor">
                <i class="bi bi-file-earmark-text me-1" aria-hidden="true"></i>${t().verTerminos} *
              </button>
              <span id="cert-terminos-estado" class="small text-warning-emphasis" role="status"></span>
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
    document.getElementById('cert-fecha-nacimiento')?.addEventListener('change', () => this._actualizarMinoria());
    document.getElementById('btn-cert-terminos')?.addEventListener('click', () => this._abrirTerminos());
    document.getElementById('btn-aceptar-terminos')?.addEventListener('click', () => this._aceptarTerminos());
    document.getElementById('btn-cert-cancelar-correccion')?.addEventListener('click', () => this._salirCorreccion());
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      sinEsperar(this._enviar(form), 'CertificadosView._enviar');
    });
    this._actualizarMinoria();
  },

  /** HU01: el bloque del menor depende de la fecha de nacimiento, no de una casilla. */
  _actualizarMinoria() {
    const fecha = document.getElementById('cert-fecha-nacimiento')?.value || '';
    const esMenor = esMenorDeEdad(fecha);
    document.getElementById('cert-bloque-menor')?.classList.toggle('d-none', !esMenor);
    this._marcarTerminos(esMenor && document.getElementById('cert-terminos-menor')?.value === 'si');
  },

  _marcarTerminos(aceptados) {
    const campo = document.getElementById('cert-terminos-menor');
    if (campo) campo.value = aceptados ? 'si' : '';
    const estado = document.getElementById('cert-terminos-estado');
    if (estado) {
      estado.className = `small ${aceptados ? 'text-success-emphasis' : 'text-warning-emphasis'}`;
      estado.innerHTML = `<i class="bi ${aceptados ? 'bi-check-circle-fill' : 'bi-exclamation-circle'} me-1" aria-hidden="true"></i>${
        aceptados ? t().terminosAceptados : t().terminosPendientes}`;
    }
  },

  _abrirTerminos() {
    const modalEl = document.getElementById('modal-terminos-menor');
    if (!modalEl || !window.bootstrap?.Modal) return;
    window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
  },

  _aceptarTerminos() {
    this._marcarTerminos(true);
    const modalEl = document.getElementById('modal-terminos-menor');
    if (modalEl && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    document.getElementById('btn-cert-terminos')?.focus();
  },

  /** Evita volver a escribir la fecha: se toma del último certificado que la tenga. */
  _precargarFechaNacimiento() {
    const campo = document.getElementById('cert-fecha-nacimiento');
    if (!campo || campo.value) return;
    const conFecha = this._certificados.find((c) => c.fecha_nacimiento);
    if (!conFecha) return;
    campo.value = conFecha.fecha_nacimiento;
    this._actualizarMinoria();
  },

  _buildModalTerminos() {
    return `
      <div class="modal fade" id="modal-terminos-menor" tabindex="-1" aria-labelledby="modal-terminos-menor-titulo" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title h5" id="modal-terminos-menor-titulo">
                <i class="bi bi-shield-check text-primary me-2" aria-hidden="true"></i>${t().terminosTitulo}
              </h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${i18n.app.cancelar}"></button>
            </div>
            <div class="modal-body">
              <p>${t().terminosIntro}</p>
              ${t().terminosSecciones.map((sec) => `
                <h3 class="h6 fw-700 mt-3">${sec.titulo}</h3>
                <p class="small mb-2">${sec.texto}</p>`).join('')}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="button" class="btn btn-primary" id="btn-aceptar-terminos">
                <i class="bi bi-check2-circle me-1" aria-hidden="true"></i>${t().terminosAceptar}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
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
        sinEsperar(this._cargar(), 'CertificadosView._cargar');
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
    // Un input hidden no vuelve a vacío con reset(): se limpia a mano.
    this._marcarTerminos(false);
    this._precargarFechaNacimiento();
    this._actualizarMinoria();
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
