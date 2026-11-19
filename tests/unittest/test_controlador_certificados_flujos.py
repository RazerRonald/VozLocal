"""CertificadoController y utils/certificados.js: caminos de error y funciones de edad.

Completa lo que no cubren las suites de HU01 a HU06: errores de Firestore, sesión
vencida, lectura del archivo como Blob, decodificación de imágenes y listados del
revisor.

Ejecutar desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import unittest

from puente import ejecutar_js

CTRL = {'C': 'js/controllers/CertificadoController.js', 'A': 'js/models/AuthModel.js',
        'M': 'js/models/CertificadoModel.js', 'I': 'js/config/i18n.js'}
UTIL = {'U': 'js/utils/certificados.js'}

SESION = """A.getSesion = () => ({ uid: 'joven-1', rol: 'estudiante', nombre_perfil: 'Ana', primer_apellido: 'Diaz',
  segundo_apellido: 'Ruiz', tipo_documento: 'CC', numero_documento: '123', ciudad_documento: 'Medellin' });"""
SIN_SESION = "A.getSesion = () => null;"
ESPIA = """const r = { carga: [] }; const llamadas = [];
const cb = { onLoading(v) { r.carga.push(v); }, onSuccess(v) { r.ok = v ?? true; }, onError(m) { r.error = m; } };
console.error = () => {};"""
FALLA = "async () => { throw Object.assign(new Error('x'), { code: '%s' }); }"
FORM = """const form = { actividad: 'Apoyo', entidad: 'JAL', horas_reportadas: '10', consentimiento_joven: 'on',
  fecha_nacimiento: '1990-05-10' };"""
PDF = """const pdf = () => { const b = new Uint8Array(200).fill(32); b.set([...'%PDF-1.4\\n'].map((c) => c.charCodeAt(0)));
  b.set([...'\\n%%EOF\\n'].map((c) => c.charCodeAt(0)), 193); return new File([b], 'c.pdf'); };"""
PNG = """const png = () => new File([Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,0,0,0,0,0,0,0,0,
  0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82])], 'c.png');"""


def correr(codigo, sesion=SESION):
    return ejecutar_js(CTRL, f'{sesion} {ESPIA} {FORM} {PDF} {PNG} {codigo} return {{ r, llamadas, t: I.certificados, app: I.app, auth: I.auth }};')


class SinSesion(unittest.TestCase):
    """Sin sesión no se consulta ni se escribe nada."""

    def test_todas_las_acciones_piden_sesion(self):
        res = correr("""
            M.listarPropios = async () => { llamadas.push('consulta'); return []; };
            M.registrar = M.corregir = M.solicitarEliminacion = M.aprobar = async () => llamadas.push('escritura');
            const errores = [];
            const guardar = { ...cb, onError: (m) => errores.push(m) };
            await C.obtenerMios(guardar);
            await C.cargar(form, pdf(), guardar);
            await C.corregir({ id: 'c1', uid_estudiante: 'joven-1' }, form, pdf(), guardar);
            await C.solicitarEliminacion('', guardar);
            await C.aprobar({ id: 'c1', horas_reportadas: 20 }, '10', guardar);
            r.errores = errores;""", sesion=SIN_SESION)
        self.assertEqual(res['r']['errores'], [res['auth']['accesoDenegado']] * 5)
        self.assertEqual(res['llamadas'], [])


class ErroresDeFirestore(unittest.TestCase):
    """Un error de Firestore se traduce a un mensaje claro y apaga el indicador de carga."""

    def test_obtener_mios_sin_permiso(self):
        res = correr(f"M.listarPropios = {FALLA % 'permission-denied'}; M.listarSolicitudesEliminacionPropias = async () => []; await C.obtenerMios(cb);")
        self.assertEqual(res['r']['error'], res['t']['errorPermiso'])

    def test_cargar_con_error_inesperado(self):
        res = correr(f"M.registrar = {FALLA % 'unavailable'}; await C.cargar(form, pdf(), cb);")
        self.assertEqual(res['r']['error'], res['app']['errorGenerico'])
        self.assertEqual(res['r']['carga'], [True, False])

    def test_corregir_cuando_el_estado_ya_cambio(self):
        res = correr(f"M.corregir = {FALLA % 'certificado/estado-cambiado'}; await C.corregir({{ id: 'c1', uid_estudiante: 'joven-1' }}, form, pdf(), cb);")
        self.assertEqual(res['r']['error'], res['t']['errorEstadoCambiado'])
        self.assertEqual(res['r']['carga'], [True, False])

    def test_solicitar_eliminacion_falla_sin_permiso(self):
        res = correr(f"M.solicitarEliminacion = {FALLA % 'permission-denied'}; await C.solicitarEliminacion('motivo', cb);")
        self.assertEqual(res['r']['error'], res['t']['errorPermiso'])
        self.assertEqual(res['r']['carga'], [True, False])

    def test_revision_con_error_y_mensaje_de_archivo_incompleto(self):
        res = correr(f"""M.rechazar = {FALLA % 'certificado/archivo-incompleto'};
            await C.rechazar({{ id: 'c1' }}, 'Falta firma', cb);""")
        self.assertEqual(res['r']['error'], res['t']['erroresArchivo']['corrupto'])
        self.assertEqual(res['r']['carga'], [True, False])

    def test_la_correccion_de_un_certificado_ajeno_no_llega_al_modelo(self):
        res = correr("M.corregir = async () => llamadas.push('corregir'); await C.corregir({ id: 'c1', uid_estudiante: 'otro' }, form, pdf(), cb);")
        self.assertEqual(res['r']['error'], res['auth']['accesoDenegado'])
        self.assertEqual(res['llamadas'], [])

    def test_correccion_con_horas_invalidas_no_escribe(self):
        res = correr("M.corregir = async () => llamadas.push('corregir'); form.horas_reportadas = '0'; await C.corregir({ id: 'c1', uid_estudiante: 'joven-1' }, form, pdf(), cb);")
        self.assertEqual(res['r']['error'], res['t']['errorHoras'])
        self.assertEqual(res['llamadas'], [])


class RevisorYArchivo(unittest.TestCase):
    """HU02 y HU06: listados del edil y entrega del archivo como Blob local."""

    def test_listar_todos_entrega_certificados_y_solicitudes(self):
        res = correr("""M.listarTodos = async () => [{ id: 'c1' }]; M.listarSolicitudesEliminacion = async () => [{ id: 's1' }];
            await C.listarTodos(cb);""")
        self.assertEqual(res['r']['ok'], {'certificados': [{'id': 'c1'}], 'solicitudes': [{'id': 's1'}]})

    def test_listar_todos_con_error(self):
        res = correr(f"M.listarTodos = {FALLA % 'permission-denied'}; M.listarSolicitudesEliminacion = async () => []; await C.listarTodos(cb);")
        self.assertEqual(res['r']['error'], res['t']['errorPermiso'])

    def test_obtener_archivo_devuelve_un_blob_con_el_tipo_original(self):
        res = correr("""M.leerArchivo = async (cert) => { llamadas.push(cert.id); return btoa('hola'); };
            const blob = await C.obtenerArchivo({ id: 'c1', archivo_tipo: 'application/pdf' });
            r.blob = { tipo: blob.type, tamano: blob.size, texto: await blob.text() };""")
        self.assertEqual(res['r']['blob'], {'tipo': 'application/pdf', 'tamano': 4, 'texto': 'hola'})
        self.assertEqual(res['llamadas'], ['c1'])


class ImagenesLegibles(unittest.TestCase):
    """HU01 criterio 4: una imagen que el navegador no puede decodificar se rechaza."""

    def cargar_png(self, decodificar):
        return correr(f"""globalThis.createImageBitmap = {decodificar};
            M.registrar = async (datos) => llamadas.push(datos.archivo_tipo);
            await C.cargar(form, png(), cb);""")

    def test_png_que_se_decodifica_se_guarda(self):
        res = self.cargar_png("async () => ({ close() {} })")
        self.assertEqual(res['llamadas'], ['image/png'])

    def test_png_que_no_se_decodifica_se_rechaza_sin_escribir(self):
        res = self.cargar_png("async () => { throw new Error('no decodifica'); }")
        self.assertEqual(res['r']['error'], res['t']['erroresArchivo']['corrupto'])
        self.assertEqual(res['llamadas'], [])

    def test_sin_archivo_no_se_guarda(self):
        res = correr("M.registrar = async () => llamadas.push('x'); await C.cargar(form, null, cb);")
        self.assertEqual(res['r']['error'], res['t']['errorArchivoRequerido'])
        self.assertEqual(res['llamadas'], [])


class EdadYFecha(unittest.TestCase):
    """HU01: edad cumplida y fecha máxima del campo de nacimiento (día UTC)."""

    def test_edad_en_anios(self):
        res = ejecutar_js(UTIL, """const hoy = new Date('2026-11-17T12:00:00Z');
            return [U.edadEnAnios('2008-11-17', hoy), U.edadEnAnios('2008-11-18', hoy), U.edadEnAnios('1990-01-01', hoy),
                    U.edadEnAnios('2026-12-01', hoy), U.edadEnAnios('no-es-fecha', hoy)];""")
        self.assertEqual(res, [18, 17, 36, None, None])

    def test_hoy_iso_usa_el_dia_utc(self):
        res = ejecutar_js(UTIL, """return [U.hoyIso(new Date('2026-11-17T04:30:00Z')), U.hoyIso(new Date('2026-02-28T23:59:59Z'))];""")
        self.assertEqual(res, ['2026-11-17', '2026-02-28'])


if __name__ == '__main__':
    unittest.main()
