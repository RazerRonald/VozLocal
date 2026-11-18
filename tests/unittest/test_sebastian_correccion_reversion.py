"""PR 2 · Sebastián Pineda — JAL-025 a JAL-028 y SC001-HU03, SC001-HU04.

Ejecutar desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import re
import unittest

from puente import ejecutar_js, leer

CTRL = {'C': 'js/controllers/CertificadoController.js', 'A': 'js/models/AuthModel.js',
        'M': 'js/models/CertificadoModel.js', 'I': 'js/config/i18n.js'}
TRAMITE = {'R': 'js/controllers/ArchivoController.js'}

PNG = """const png = () => Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,0,0,0,0,0,0,0,0,
  0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]);"""
SESION = """A.getSesion = () => ({ uid: 'joven-1', rol: 'estudiante', nombre_perfil: 'Ana', primer_apellido: 'Diaz',
  segundo_apellido: 'Ruiz', numero_documento: '123' });"""
ESPIA = """const llamadas = []; const r = {};
const cb = { onLoading() {}, onSuccess() { r.ok = true; }, onError(m) { r.error = m; } };
M.corregir = async (cert, datos, partes) => llamadas.push({ cert: cert.id, datos, partes: partes.length });
M.revertir = async (...a) => llamadas.push(['revertir', ...a]);"""
RECHAZADO = "const cert = { id: 'c9', uid_estudiante: 'joven-1', estado: 'Rechazado', version: 1, horas_reportadas: 20 };"
FORM = "const form = { actividad: 'Apoyo', entidad: 'JAL', horas_reportadas: '20' };"


class CorreccionHU03(unittest.TestCase):
    """SC001-HU03: el dueño reenvía un certificado rechazado."""

    def corregir(self, ajuste='', archivo="new File([png()], 'corregido.png')"):
        return ejecutar_js(CTRL, f"""{PNG} {SESION} {ESPIA} {RECHAZADO} {FORM} {ajuste}
            await C.corregir(cert, form, {archivo}, cb);
            return {{ r, llamadas, textos: I }};""")

    def test_correccion_valida_envia_solo_datos_y_archivo_nuevos(self):
        res = self.corregir()
        self.assertTrue(res['r'].get('ok'))
        llamada = res['llamadas'][0]
        self.assertEqual(llamada['cert'], 'c9')
        self.assertEqual(llamada['datos']['archivo_tipo'], 'image/png')
        # Los consentimientos ya otorgados no se tocan en la corrección.
        self.assertFalse({'consentimiento_joven', 'es_menor', 'uid_estudiante'} & set(llamada['datos']))

    def test_no_se_corrige_un_certificado_ajeno(self):
        res = self.corregir("cert.uid_estudiante = 'otro-joven';")
        self.assertEqual(res['r']['error'], res['textos']['auth']['accesoDenegado'])
        self.assertEqual(res['llamadas'], [])

    def test_correccion_con_archivo_invalido_conserva_el_estado(self):
        res = self.corregir(archivo="new File([new Uint8Array(0)], 'vacio.pdf')")
        self.assertEqual(res['r']['error'], res['textos']['certificados']['erroresArchivo']['vacio'])
        self.assertEqual(res['llamadas'], [])


class ReversionHU04(unittest.TestCase):
    """SC001-HU04: revertir una aprobación con motivo visible para el joven."""

    def revertir(self, motivo):
        return ejecutar_js(CTRL, f"""{SESION} {ESPIA}
            await C.revertir({{ id: 'c1', estado: 'Aprobado', horas_aprobadas: 18 }}, {motivo!r}, cb);
            return {{ r, llamadas, textos: I.certificados }};""")

    def test_revertir_exige_motivo(self):
        res = self.revertir('  ')
        self.assertEqual(res['r']['error'], res['textos']['errorMotivo'])
        self.assertEqual(res['llamadas'], [])

    def test_revertir_envia_motivo_normalizado(self):
        res = self.revertir(' Horas de   otra convocatoria ')
        self.assertEqual(res['llamadas'], [['revertir', 'c1', 'Horas de otra convocatoria', 'joven-1']])

    def test_reintento_sobre_estado_cambiado_avisa_sin_reaplicar(self):
        res = ejecutar_js(CTRL, f"""{SESION} {ESPIA}
            M.revertir = async () => {{ throw Object.assign(new Error('x'), {{ code: 'certificado/estado-cambiado' }}); }};
            await C.revertir({{ id: 'c1' }}, 'motivo', cb);
            return {{ r, textos: I.certificados }};""")
        self.assertEqual(res['r']['error'], res['textos']['errorEstadoCambiado'])


class CartasDocxDriveJAL025a028(unittest.TestCase):
    """E03: nombre del DOCX y carpeta de Drive por estudiante y documento."""

    def test_nombre_de_archivo_sin_tildes_ni_rutas_JAL025(self):
        nombre = ejecutar_js(TRAMITE, "return R._sanitizarNombre('José Pérez/../Ñandú x'.repeat(5));")
        self.assertRegex(nombre, r'^[A-Za-z0-9_-]+$')
        self.assertLessEqual(len(nombre), 50)
        self.assertTrue(nombre.startswith('Jose_Perez'))

    def test_subcarpeta_por_estudiante_y_documento_JAL027(self):
        res = ejecutar_js(TRAMITE, """return [R._buildNombreCarpetaEstudiante({ nombre_completo: 'Ana Diaz', numero_documento: '123' }),
                                           R._buildNombreCarpetaEstudiante({})];""")
        self.assertEqual(res, ['Ana Diaz - 123', 'Estudiante'])

    def test_sufijo_de_fecha_evita_nombres_duplicados_JAL028(self):
        sufijo = ejecutar_js(TRAMITE, 'return R._timestampArchivo();')
        self.assertTrue(re.fullmatch(r'\d{4}-\d{2}-\d{2}_\d{4}', sufijo), sufijo)

    def test_vista_previa_de_carta_inicial_permite_expedir_JAL027_JAL028(self):
        # Defecto encontrado el 16/11/2026: el botón Expedir se ocultaba siempre y nadie llamaba a expedirDocumento.
        vista = leer('js/views/AdminView.js')
        inicio = vista.index('  _mostrarVistaPrevia(tramite) {')
        cuerpo = vista[inicio:vista.index('  _mostrarVistaPreviaFinalizacion(', inicio)]
        self.assertNotIn("btnExpedir.classList.add('d-none')", cuerpo)
        self.assertIn('ArchivoController.expedirDocumento(tramite.id, tramite,', cuerpo)
        self.assertIn('i18n.admin.marcarExpedida', cuerpo)


if __name__ == '__main__':
    unittest.main()
