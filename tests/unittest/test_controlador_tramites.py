"""ArchivoController (E03 · JAL-020 a JAL-033): flujos completos con modelo y librerías simulados.

Se reemplazan ArchivoModel, la sesión, fetch (plantilla DOCX) y las librerías
PizZip/docxtemplater, así que se prueba la orquestación sin Firestore, Drive ni
navegador.

Ejecutar desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import unittest

from puente import ejecutar_js

MODS = {'R': 'js/controllers/ArchivoController.js', 'M': 'js/models/ArchivoModel.js',
        'A': 'js/models/AuthModel.js', 'I': 'js/config/i18n.js'}

BASE = """
console.error = () => {}; console.warn = () => {};
A.getSesion = () => ({ uid: 'joven-1', email: 'ana@example.test', nombre_perfil: 'Ana', primer_apellido: 'Díaz',
  segundo_apellido: 'Ruiz', tipo_documento: 'CC', numero_documento: '123', ciudad_documento: 'Medellín' });
const r = { carga: [], progreso: [] }; const llamadas = [];
const cb = { onLoading(v) { r.carga.push(v); }, onProgress(m) { r.progreso.push(m); },
  onSuccess(v) { r.ok = v ?? true; }, onError(m) { r.error = m; } };
const falla = (code, message = 'x') => async () => { throw Object.assign(new Error(message), { code }); };
const docx = {};
const instalarLibs = () => {
  globalThis.PizZip = class { constructor(buf) { docx.bytes = buf.byteLength; } };
  globalThis.docxtemplater = class {
    constructor(zip, opts) { docx.opts = opts; }
    render(d) { docx.datos = d; }
    getZip() { return { generate: (o) => ({ blob: true, mime: o.mimeType }) }; }
  };
};
const quitarLibs = () => { for (const n of ['PizZip', 'pizzip', 'Pizzip', 'docxtemplater', 'Docxtemplater', 'DocxTemplater']) delete globalThis[n]; };
globalThis.fetch = async (url) => { docx.url = url; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
const TRAMITE = { nombre_completo: 'Ana Díaz Ruiz', tipo_documento: 'CC', numero_documento: '123', ciudad_documento: 'Medellín',
  universidad: 'UdeA', carrera: 'Software', semestre_actual: 5, horas_a_realizar: 80, lugar_realizacion: 'JAL' };
"""


def correr(codigo):
    return ejecutar_js(MODS, f'{BASE} {codigo} return {{ r, llamadas, docx, tramite: I.tramite, admin: I.admin, app: I.app, auth: I.auth }};')


class SolicitudesDelEstudiante(unittest.TestCase):
    """JAL-020 a JAL-022 y JAL-029: historial, solicitud y carta de finalización."""

    def test_obtener_mis_tramites(self):
        res = correr("""
            M.getTramitesPorEstudiante = async (uid) => [{ id: 't1', uid }];
            await R.obtenerMisTramites(cb); r.lista = r.ok;
            M.getTramitesPorEstudiante = falla('permission-denied'); r.ok = undefined;
            await R.obtenerMisTramites(cb); r.sinPermiso = r.ok;
            M.getTramitesPorEstudiante = falla('unavailable');
            await R.obtenerMisTramites(cb); r.inesperado = r.error;
            A.getSesion = () => null;
            await R.obtenerMisTramites(cb);""")
        self.assertEqual(res['r']['lista'], [{'id': 't1', 'uid': 'joven-1'}])
        self.assertEqual(res['r']['sinPermiso'], [])  # el formulario se muestra aunque no pueda leer el historial
        self.assertEqual(res['r']['inesperado'], res['app']['errorGenerico'])
        self.assertEqual(res['r']['error'], res['auth']['accesoDenegado'])
        self.assertEqual(res['r']['carga'], [True, False] * 3)  # sin sesión no se activa la carga

    def test_enviar_solicitud_valida_registra_con_la_identidad_de_la_sesion(self):
        res = correr("""
            M.registrarSolicitud = async (d) => llamadas.push(d);
            await R.enviarSolicitud({ universidad: 'UdeA', carrera: 'Software', semestre_actual: '5', horas_a_realizar: '80',
              lugar_realizacion: 'JAL' }, cb);""")
        self.assertTrue(res['r']['ok'])
        self.assertEqual(res['llamadas'][0]['uid_estudiante'], 'joven-1')
        self.assertEqual(res['llamadas'][0]['nombre_completo'], 'Ana Díaz Ruiz')
        self.assertEqual(res['r']['progreso'], [res['tramite']['guardandoFirestore']])

    def test_enviar_solicitud_invalida_o_con_error(self):
        res = correr("""
            const form = { universidad: 'UdeA', carrera: 'Software', semestre_actual: '5', horas_a_realizar: '80', lugar_realizacion: 'JAL' };
            const errores = []; const guardar = { ...cb, onError: (m) => errores.push(m) };
            await R.enviarSolicitud({ ...form, carrera: '' }, guardar);
            M.registrarSolicitud = falla('permission-denied'); await R.enviarSolicitud(form, guardar);
            M.registrarSolicitud = falla('', 'Missing or insufficient permissions.'); await R.enviarSolicitud(form, guardar);
            M.registrarSolicitud = falla('unavailable'); await R.enviarSolicitud(form, guardar);
            A.getSesion = () => null; await R.enviarSolicitud(form, guardar);
            r.errores = errores;""")
        t = res['tramite']
        self.assertEqual(res['r']['errores'], [t['errorCampos'], t['errorPermisosFirestore'], t['errorPermisosFirestore'],
                                               t['errorSubir'], res['auth']['accesoDenegado']])

    def test_solicitar_finalizacion_solo_con_carta_expedida_propia(self):
        res = correr("""
            const errores = []; const guardar = { ...cb, onError: (m) => errores.push(m) };
            M.solicitarFinalizacion = async (id) => llamadas.push(id);
            const propio = { uid_estudiante: 'joven-1', estado: 'Expedida' };
            await R.solicitarFinalizacion('t1', { ...propio, uid_estudiante: 'otro' }, guardar);
            await R.solicitarFinalizacion('t1', { ...propio, estado: 'Aprobado' }, guardar);
            await R.solicitarFinalizacion('t1', { ...propio, finalizacion_estado: 'Pendiente' }, guardar);
            await R.solicitarFinalizacion('t1', propio, guardar);
            M.solicitarFinalizacion = falla('permission-denied'); await R.solicitarFinalizacion('t1', propio, guardar);
            M.solicitarFinalizacion = falla('unavailable'); await R.solicitarFinalizacion('t1', propio, guardar);
            r.errores = errores;""")
        t = res['tramite']
        self.assertEqual(res['llamadas'], ['t1'])
        self.assertTrue(res['r']['ok'])
        self.assertEqual(res['r']['errores'], [res['auth']['accesoDenegado'], t['errorFinalizacionNoDisponible'],
                                               t['errorFinalizacionYaSolicitada'], t['errorPermisosFinalizacion'],
                                               t['errorSolicitarFinalizacion']])


class CartasDocxYDrive(unittest.TestCase):
    """JAL-025 a JAL-028 y JAL-030: generar, descargar, subir a Drive y expedir."""

    def test_expedir_carta_inicial_genera_sube_a_la_carpeta_del_estudiante_y_registra(self):
        res = correr("""
            instalarLibs();
            M.subirDrive = async (blob, nombre, opciones) => { llamadas.push({ blob, nombre, opciones }); return { fileId: 'f1', viewUrl: 'u1' }; };
            M.expedirTramite = async (...a) => llamadas.push(a);
            await R.expedirDocumento('t1', TRAMITE, cb);""")
        subida = res['llamadas'][0]
        self.assertRegex(subida['nombre'], r'^Carta_Barrial_Ana_Diaz_Ruiz_\d{4}-\d{2}-\d{2}_\d{4}\.docx$')
        self.assertEqual(subida['opciones'], {'carpetaEstudiante': 'Ana Díaz Ruiz - 123', 'compartirConEmail': 'ana@example.test'})
        self.assertEqual(subida['blob']['mime'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        self.assertEqual(res['llamadas'][1], ['t1', 'f1', 'u1'])
        self.assertEqual(res['r']['ok'], {'viewUrl': 'u1'})
        self.assertEqual(res['docx']['url'], 'assets/Plantilla.docx')
        self.assertEqual(res['docx']['datos']['semestre_actual'], '5')
        self.assertEqual(res['docx']['opts']['delimiters'], {'start': '{{', 'end': '}}'})
        self.assertEqual(res['r']['progreso'], [res['tramite']['generandoDocumento'], res['tramite']['subiendoDocumento']])

    def test_expedir_carta_de_finalizacion_usa_su_plantilla(self):
        res = correr("""
            instalarLibs();
            M.subirDrive = async (blob, nombre) => { llamadas.push(nombre); return { fileId: 'f2', viewUrl: 'u2' }; };
            M.expedirFinalizacion = async (...a) => llamadas.push(a);
            await R.expedirDocumentoFinalizacion('t1', { ...TRAMITE, ciudad_documento: '' }, cb);""")
        self.assertTrue(res['llamadas'][0].startswith('Carta_Finalizacion_Ana_Diaz_Ruiz_'))
        self.assertEqual(res['llamadas'][1], ['t1', 'f2', 'u2'])
        self.assertEqual(res['docx']['url'], 'assets/Plantilla.Finalizacion.docx')
        self.assertEqual(res['docx']['datos']['ciudad_documento'], '')

    def test_descargar_cartas_sin_subir_a_drive(self):
        res = correr("""
            instalarLibs();
            M.subirDrive = async () => llamadas.push('drive');
            await R.descargarCarta(TRAMITE, cb); r.inicial = r.ok;
            await R.descargarCartaFinalizacion({ ...TRAMITE, nombre_completo: '' }, cb); r.final = r.ok;""")
        self.assertEqual(res['llamadas'], [])
        self.assertTrue(res['r']['inicial']['nombreArchivo'].startswith('Carta_Barrial_Ana_Diaz_Ruiz_'))
        self.assertTrue(res['r']['final']['nombreArchivo'].startswith('Carta_Finalizacion_Estudiante_'))
        self.assertTrue(res['r']['final']['blob']['blob'])

    def test_errores_al_generar_o_subir_muestran_un_mensaje_y_apagan_la_carga(self):
        res = correr("""
            instalarLibs();
            const errores = []; const guardar = { ...cb, onError: (m) => errores.push(m) };
            M.subirDrive = falla('', 'Drive no responde');
            await R.expedirDocumento('t1', TRAMITE, guardar);
            await R.expedirDocumentoFinalizacion('t1', TRAMITE, guardar);
            globalThis.fetch = async () => ({ ok: false });
            await R.descargarCarta(TRAMITE, guardar);
            await R.descargarCartaFinalizacion(TRAMITE, guardar);
            globalThis.fetch = async () => { throw {}; };
            await R.expedirDocumento('t1', TRAMITE, guardar);
            r.errores = errores;""")
        self.assertEqual(res['r']['errores'], ['Drive no responde', 'Drive no responde', 'No se pudo cargar la plantilla',
                                               'No se pudo cargar la plantilla', res['tramite']['errorGenerar']])
        self.assertEqual(res['r']['carga'], [True, False] * 5)


class RevisionDelEdil(unittest.TestCase):
    """JAL-023, JAL-024 y JAL-031: aprobar y rechazar con sugerencia."""

    def test_listar_y_suscribir(self):
        res = correr("""
            M.getAllTramites = async () => [{ id: 't1' }]; await R.listarTodos(cb); r.lista = r.ok;
            M.getAllTramites = falla('unavailable'); await R.listarTodos(cb);
            M.onSnapshotAll = (fn) => { fn([{ id: 't2' }]); return 'cancelar'; };
            r.suscripcion = R.suscribirTodos((lista) => llamadas.push(lista));""")
        self.assertEqual(res['r']['lista'], [{'id': 't1'}])
        self.assertEqual(res['r']['error'], res['app']['errorGenerico'])
        self.assertEqual(res['r']['suscripcion'], 'cancelar')
        self.assertEqual(res['llamadas'], [[{'id': 't2'}]])

    def test_aprobar(self):
        res = correr("""
            const errores = []; const guardar = { ...cb, onError: (m) => errores.push(m) };
            M.actualizarEstado = async (...a) => llamadas.push(a);
            await R.aprobar('t1', guardar);
            M.actualizarEstado = falla('permission-denied'); await R.aprobar('t1', guardar);
            A.getSesion = () => null; await R.aprobar('t1', guardar);
            r.errores = errores;""")
        self.assertEqual(res['llamadas'], [['t1', 'Aprobado']])
        self.assertEqual(res['r']['errores'], [res['admin']['errorAccion'], res['auth']['accesoDenegado']])

    def test_rechazar_solicitud_y_finalizacion_exigen_sugerencia(self):
        res = correr("""
            const errores = []; const guardar = { ...cb, onError: (m) => errores.push(m) };
            M.rechazarTramite = async (...a) => llamadas.push(['inicial', ...a]);
            M.rechazarFinalizacion = async (...a) => llamadas.push(['final', ...a]);
            await R.rechazar('t1', '  Falta   la firma ', guardar);
            await R.rechazarFinalizacion('t1', 'Revisar horas', guardar);
            await R.rechazar('t1', '   ', guardar);
            await R.rechazarFinalizacion('t1', 'x'.repeat(1001), guardar);
            M.rechazarTramite = falla('unavailable'); await R.rechazar('t1', 'motivo', guardar);
            M.rechazarFinalizacion = falla('unavailable'); await R.rechazarFinalizacion('t1', 'motivo', guardar);
            A.getSesion = () => null;
            await R.rechazar('t1', 'motivo', guardar); await R.rechazarFinalizacion('t1', 'motivo', guardar);
            r.errores = errores;""")
        a = res['admin']
        self.assertEqual(res['llamadas'], [['inicial', 't1', 'Falta la firma', 'joven-1'], ['final', 't1', 'Revisar horas', 'joven-1']])
        self.assertEqual(res['r']['errores'], [a['sugerenciaCorreccionRequerida'], a['sugerenciaCorreccionRequerida'],
                                               a['errorAccion'], a['errorAccion'],
                                               res['auth']['accesoDenegado'], res['auth']['accesoDenegado']])


class LibreriasDocx(unittest.TestCase):
    """Carga de PizZip y docxtemplater: globales, scripts locales y CDN de respaldo."""

    def test_resuelve_los_nombres_globales_de_las_versiones_umd(self):
        res = correr("""
            quitarLibs(); const sinLibs = R._resolverLibreriasDocx();
            globalThis.pizzip = { default: 'pz' }; globalThis.Docxtemplater = 'dx';
            const alternativos = R._resolverLibreriasDocx();
            r.resueltos = [Boolean(sinLibs.PizZipCtor || sinLibs.DocxCtor), alternativos.PizZipCtor, alternativos.DocxCtor];""")
        self.assertEqual(res['r']['resueltos'], [False, 'pz', 'dx'])

    def test_si_faltan_las_librerias_las_carga_desde_el_primer_script_que_responda(self):
        res = correr("""
            quitarLibs();
            const cargados = [];
            document.scripts = [];
            document.createElement = () => ({ dataset: {} });
            document.head = { appendChild: (s) => {
              cargados.push(s.src);
              if (s.src.includes('pizzip') && !s.src.startsWith('js/')) { globalThis.PizZip = class { constructor() {} }; s.onload(); }
              else if (s.src.includes('docxtemplater')) { s.onload(); globalThis.docxtemplater = class {
                constructor() {} render() {} getZip() { return { generate: () => 'blob' }; } }; }
              else s.onerror();
            } };
            r.blob = await R._generarDocx(TRAMITE);
            r.cargados = cargados;""")
        self.assertEqual(res['r']['blob'], 'blob')
        self.assertEqual(res['r']['cargados'][:2], ['js/vendor/pizzip.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/PizZip/3.1.4/pizzip.umd.min.js'])
        self.assertIn('js/vendor/docxtemplater.js', res['r']['cargados'])

    def test_si_ningun_script_carga_avisa_que_faltan_las_librerias(self):
        res = correr("""
            quitarLibs();
            document.scripts = [];
            document.createElement = () => ({});
            document.head = { appendChild: (s) => s.onerror() };
            try { await R._generarDocx(TRAMITE); r.error = 'sin error'; } catch (e) { r.error = e.message; }""")
        self.assertIn('Librerías docxtemplater no cargadas', res['r']['error'])

    def test_un_script_que_carga_sin_publicar_el_global_se_descarta(self):
        res = correr("""
            quitarLibs();
            document.scripts = [];
            document.createElement = () => ({});
            document.head = { appendChild: (s) => s.onload() };
            try { await R._cargarScriptGlobal(['a.js', 'b.js'], () => null, 'PizZip'); } catch (e) { r.error = e.message; }
            r.existente = await R._cargarScriptGlobal(['a.js'], () => 'ya-estaba', 'PizZip');""")
        self.assertEqual(res['r']['error'], 'No se pudo cargar PizZip desde los CDN configurados')
        self.assertEqual(res['r']['existente'], 'ya-estaba')

    def test_espera_un_script_existente_hasta_que_carga_o_falla(self):
        res = correr("""
            const script = (src) => { const oyentes = {}; return { src, dataset: {},
              addEventListener: (ev, fn) => { oyentes[ev] = fn; }, disparar: (ev) => oyentes[ev]() }; };
            const yaCargado = script('a.js'); yaCargado.dataset.docxLibLoaded = 'true';
            await R._esperarScript(yaCargado);
            const cargando = script('b.js'); const espera = R._esperarScript(cargando); cargando.disparar('load'); await espera;
            const fallido = script('c.js'); const espera2 = R._esperarScript(fallido); fallido.disparar('error');
            try { await espera2; } catch (e) { r.error = e.message; }
            r.marcado = cargando.dataset.docxLibLoaded;
            document.scripts = [cargando];
            r.desdeExistente = await R._cargarScriptGlobal(['b.js'], (() => { let n = 0; return () => (n++ ? 'listo' : null); })(), 'X');""")
        self.assertEqual(res['r']['marcado'], 'true')
        self.assertEqual(res['r']['error'], 'Error cargando script existente c.js')
        self.assertEqual(res['r']['desdeExistente'], 'listo')


class Utilidades(unittest.TestCase):
    """Valores por defecto de nombres de archivo, carpeta y correo de Drive."""

    def test_valores_por_defecto(self):
        res = correr("""
            r.valores = [R._sanitizarNombre(undefined), R._buildNombreCarpetaEstudiante({}), R._getCorreoCompartirDrive()];
            A.getSesion = () => null; r.valores.push(R._getCorreoCompartirDrive());
            r.valores.push(R._datosPerfilSesion({ nombre: '  Ana  ' }).nombre_completo, R._datosPerfilSesion().nombre_completo);""")
        self.assertEqual(res['r']['valores'], ['Estudiante', 'Estudiante', 'ana@example.test', '', 'Ana', ''])


if __name__ == '__main__':
    unittest.main()
