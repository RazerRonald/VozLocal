/**
 * @fileoverview AdminCertificadosView — Revisión de certificados de servicio
 * social por el Edil (#/admin/certificados): aprobar o rechazar
 * (E04 / SC-001).
 *
 * @module views/AdminCertificadosView
 */

import CertificadoController from '../controllers/CertificadoController.js';
import Toast                 from '../components/Toast.js';
import { i18n }              from '../config/i18n.js';
import { ESTADOS_CERTIFICADO } from '../config/collections.js';

const t = () => i18n.certificados;

const AdminCertificadosView = {
  _certificados: [],
  _filtro: ESTADOS_CERTIFICADO.PENDIENTE,
  _busy: false,

  async render() {
    const root = document.getElementById('app-root');
    if (!root) return;
    this._filtro = ESTADOS_CERTIFICADO.PENDIENTE;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/admin" class="text-white-50">Admin</a></li>
              <li class="breadcrumb-item active">${t().adminTitulo}</li>
            </ol>
          </nav>
          <h1><i class="bi bi-patch-check me-2"></i>${t().adminTitulo}</h1>
          <p class="page-hero-sub">${t().adminSubtitulo}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="mb-4">
          <a href="#/admin" class="btn-jal-secondary d-inline-flex align-items-center gap-1">
            <i class="bi bi-arrow-left"></i>Panel Admin
          </a>
        </div>

        <div class="solicitudes-acceso-resumen mb-4" aria-label="Resumen de certificados">
          ${this._buildResumenItem(ESTADOS_CERTIFICADO.PENDIENTE, 'bi-hourglass-split', 'warning')}
          ${this._buildResumenItem(ESTADOS_CERTIFICADO.APROBADO, 'bi-check-circle', 'success')}
          ${this._buildResumenItem(ESTADOS_CERTIFICADO.RECHAZADO, 'bi-x-circle', 'danger')}
        </div>

        <section class="form-jal p-0 overflow-hidden mb-4" aria-labelledby="admin-cert-titulo">
          <div class="p-4 border-bottom d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <h2 class="h5 fw-700 mb-0" id="admin-cert-titulo">
              <i class="bi bi-list-check text-primary me-2"></i>${t().listado}
            </h2>
            <div class="d-flex align-items-center gap-2">
              <label for="filtro-certificados" class="small text-muted fw-600">${t().filtrar}</label>
              <select id="filtro-certificados" class="form-select form-select-sm solicitudes-acceso-filtro">
                <option value="${ESTADOS_CERTIFICADO.PENDIENTE}" selected>${t().estados.Pendiente}</option>
                <option value="${ESTADOS_CERTIFICADO.APROBADO}">${t().estados.Aprobado}</option>
                <option value="${ESTADOS_CERTIFICADO.RECHAZADO}">${t().estados.Rechazado}</option>
                <option value="todos">${t().todos}</option>
              </select>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-jal mb-0" aria-label="${t().listado}">
              <thead>
                <tr>
                  <th scope="col">${t().colJoven}</th>
                  <th scope="col">${t().colActividad}</th>
                  <th scope="col">${t().colHoras}</th>
                  <th scope="col">${t().colEstado}</th>
                  <th scope="col" class="text-end">${t().colAcciones}</th>
                </tr>
              </thead>
              <tbody id="tabla-certificados-body">
                <tr><td colspan="5" class="text-center py-5 text-muted">
                  <span class="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true"></span>${i18n.app.cargando}
                </td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="modal fade modal-jal" id="modal-revisar-certificado" tabindex="-1"
           aria-labelledby="modal-revisar-certificado-titulo" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <form class="modal-content" id="form-revisar-certificado" novalidate>
            <div class="modal-header">
              <h5 class="modal-title" id="modal-revisar-certificado-titulo"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${i18n.app.cerrar}"></button>
            </div>
            <div class="modal-body" id="modal-revisar-certificado-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="submit" class="btn btn-primary" id="btn-confirmar-revision">${i18n.app.confirmar}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('filtro-certificados')?.addEventListener('change', (event) => {
      this._filtro = event.target.value;
      this._renderTabla();
    });
    document.getElementById('tabla-certificados-body')?.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-id]');
      const cert = btn && this._certificados.find((c) => c.id === btn.dataset.id);
      if (!cert || this._busy) return;
      if (btn.classList.contains('btn-cert-ver')) this._ver(cert, btn);
      if (btn.classList.contains('btn-cert-aprobar')) this._abrirRevision(cert, 'aprobar');
      if (btn.classList.contains('btn-cert-rechazar')) this._abrirRevision(cert, 'rechazar');
    });

    await this._cargar();
  },

  async _cargar() {
    await CertificadoController.listarTodos({
      onSuccess: ({ certificados }) => {
        this._certificados = certificados;
        this._renderResumen();
        this._renderTabla();
      },
      onError: (msg) => {
        const tbody = document.getElementById('tabla-certificados-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-danger">${this._esc(msg)}</td></tr>`;
      },
    });
  },

  _buildResumenItem(estado, icono, color) {
    return `
      <div class="solicitudes-acceso-stat">
        <span class="solicitudes-acceso-stat-icon text-${color}" aria-hidden="true"><i class="bi ${icono}"></i></span>
        <span class="solicitudes-acceso-stat-number" id="stat-cert-${estado}">0</span>
        <span class="solicitudes-acceso-stat-label">${t().estados[estado]}</span>
      </div>
    `;
  },

  _renderResumen() {
    Object.values(ESTADOS_CERTIFICADO).forEach((estado) => {
      const el = document.getElementById(`stat-cert-${estado}`);
      if (el) el.textContent = String(this._certificados.filter((c) => c.estado === estado).length);
    });
  },

  _renderTabla() {
    const tbody = document.getElementById('tabla-certificados-body');
    if (!tbody) return;
    const lista = this._filtro === 'todos' ? this._certificados : this._certificados.filter((c) => c.estado === this._filtro);
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">
        <i class="bi bi-inbox d-block mb-2 opacity-50" style="font-size:2rem"></i>${t().sinCertificadosAdmin}
      </td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map((c) => `
      <tr>
        <td>
          <div class="fw-600">${this._esc(c.nombre_estudiante)}</div>
          <small class="text-muted">${this._esc(c.numero_documento)}${c.es_menor ? ` · Menor (acudiente: ${this._esc(c.acudiente_nombre)})` : ''}</small>
        </td>
        <td>
          <div>${this._esc(c.actividad)}</div>
          <small class="text-muted">${this._esc(c.entidad)} · ${this._formatFecha(c.fecha_carga)}</small>
          ${c.estado === ESTADOS_CERTIFICADO.RECHAZADO && c.motivo_rechazo ? `
            <div class="small text-danger mt-1">${t().motivo}: ${this._esc(c.motivo_rechazo)}</div>` : ''}
        </td>
        <td class="text-nowrap">
          <strong>${c.estado === ESTADOS_CERTIFICADO.APROBADO ? c.horas_aprobadas : 0}</strong>
          <small class="text-muted">/ ${c.horas_reportadas} ${t().horasReportadas}</small>
        </td>
        <td>${this._buildEstado(c.estado)}</td>
        <td class="text-end">
          <div class="d-flex gap-1 justify-content-end flex-wrap">
            <button type="button" class="btn btn-sm btn-outline-primary btn-cert-ver" data-id="${this._esc(c.id)}">
              <i class="bi bi-eye me-1"></i>${t().verArchivo}
            </button>
            ${c.estado === ESTADOS_CERTIFICADO.PENDIENTE ? `
              <button type="button" class="btn btn-sm btn-outline-success btn-cert-aprobar" data-id="${this._esc(c.id)}">
                <i class="bi bi-check2-circle me-1"></i>${t().aprobar}
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger btn-cert-rechazar" data-id="${this._esc(c.id)}">
                <i class="bi bi-x-lg me-1"></i>${t().rechazar}
              </button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  /** HU02: modal con horas verificadas o motivo obligatorio. */
  _abrirRevision(cert, accion) {
    const modalEl = document.getElementById('modal-revisar-certificado');
    const form = document.getElementById('form-revisar-certificado');
    if (!modalEl || !form) return;

    const titulos = { aprobar: t().aprobarTitulo, rechazar: t().rechazarTitulo };
    document.getElementById('modal-revisar-certificado-titulo').textContent = titulos[accion];
    document.getElementById('modal-revisar-certificado-body').innerHTML = `
      <p class="mb-3"><strong>${this._esc(cert.nombre_estudiante)}</strong> · ${this._esc(cert.actividad)}
        (${cert.horas_reportadas} ${t().horasReportadas})</p>
      ${accion === 'aprobar' ? `
        <label for="revision-horas" class="form-label">${t().horasVerificadas} *</label>
        <input type="number" id="revision-horas" class="form-control" min="0.5" max="${cert.horas_reportadas}" step="0.5"
               value="${cert.horas_reportadas}" required />` : `
        <label for="revision-motivo" class="form-label">${t().motivo} *</label>
        <textarea id="revision-motivo" class="form-control" rows="3" maxlength="1000" required
                  placeholder="${t().motivoPlaceholder}"></textarea>`}
    `;
    const boton = document.getElementById('btn-confirmar-revision');
    boton.className = `btn btn-${accion === 'aprobar' ? 'success' : 'danger'}`;

    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    form.onsubmit = (event) => {
      event.preventDefault();
      const valor = document.getElementById(accion === 'aprobar' ? 'revision-horas' : 'revision-motivo')?.value;
      CertificadoController[accion](cert, valor, {
        onLoading: (cargando) => { this._busy = cargando; boton.disabled = cargando; },
        onSuccess: () => { modal.hide(); Toast.exito(t().revisadoOk); this._cargar(); },
        onError: (msg) => {
          Toast.error(msg);
          if (msg === t().errorEstadoCambiado) { modal.hide(); this._cargar(); }
        },
      });
    };
    modalEl.addEventListener('shown.bs.modal', () => modalEl.querySelector('input, textarea')?.focus(), { once: true });
    modal.show();
  },

  /** HU02: el archivo se abre como Blob local, sin URL pública. */
  async _ver(cert, btn) {
    btn.disabled = true;
    const ventana = window.open('', '_blank'); // se abre antes del await para que el navegador no la bloquee
    try {
      const blob = await CertificadoController.obtenerArchivo(cert);
      const url = URL.createObjectURL(blob);
      if (ventana) ventana.location.href = url;
      else Object.assign(document.createElement('a'), { href: url, download: cert.archivo_nombre }).click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      ventana?.close();
      console.error('[AdminCertificadosView._ver]', err);
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
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
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

export default AdminCertificadosView;
