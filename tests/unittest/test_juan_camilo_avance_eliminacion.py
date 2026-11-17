"""PR 3 · Juan Camilo Foronda — JAL-029 a JAL-033 y SC001-HU05, SC001-HU06.

Ejecutar desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import unittest

from puente import ejecutar_js

UTIL = {'U': 'js/utils/certificados.js'}
CTRL = {'C': 'js/controllers/CertificadoController.js', 'A': 'js/models/AuthModel.js',
        'M': 'js/models/CertificadoModel.js', 'I': 'js/config/i18n.js'}
TRAMITE = {'R': 'js/controllers/ArchivoController.js', 'AM': 'js/models/ArchivoModel.js',
           'A': 'js/models/AuthModel.js', 'I': 'js/config/i18n.js'}

SESION = """A.getSesion = () => ({ uid: 'joven-1', rol: 'estudiante', nombre_perfil: 'Ana', primer_apellido: 'Diaz',
  segundo_apellido: 'Ruiz', numero_documento: '123' });"""
CB = "const r = {}; const cb = { onLoading() {}, onSuccess(x) { r.ok = x ?? true; }, onError(m) { r.error = m; } };"


class AvanceHU05(unittest.TestCase):
    """SC001-HU05: horas aprobadas frente a la meta de 80."""

    def avance(self, certificados):
        return ejecutar_js(UTIL, f'return U.calcularAvance({certificados}, 80);')

    def test_solo_suman_los_aprobados(self):
        # Aunque un Pendiente o Rechazado trajera horas (dato inconsistente), no deben contar.
        res = self.avance("[{estado:'Aprobado',horas_aprobadas:30},{estado:'Pendiente',horas_aprobadas:15},{estado:'Rechazado',horas_aprobadas:20}]")
        self.assertEqual(res['horas'], 30)
        self.assertEqual(res['faltan'], 50)

    def test_79_horas_meta_pendiente_80_cumplida(self):
        self.assertFalse(self.avance("[{estado:'Aprobado',horas_aprobadas:79}]")['cumplida'])
        self.assertTrue(self.avance("[{estado:'Aprobado',horas_aprobadas:40},{estado:'Aprobado',horas_aprobadas:40}]")['cumplida'])

    def test_no_recorta_el_acumulado_real(self):
        res = self.avance("[{estado:'Aprobado',horas_aprobadas:95}]")
        self.assertEqual((res['horas'], res['porcentaje'], res['faltan']), (95, 100, 0))

    def test_sin_certificados(self):
        self.assertEqual(self.avance('[]'), {'horas': 0, 'meta': 80, 'faltan': 80, 'cumplida': False, 'porcentaje': 0})

    def test_la_vista_recibe_el_avance_calculado(self):
        res = ejecutar_js(CTRL, f"""{SESION} {CB}
            M.listarPropios = async () => [{{ estado: 'Aprobado', horas_aprobadas: 18 }}, {{ estado: 'Rechazado', horas_aprobadas: 0, revertido: true }}];
            M.listarSolicitudesEliminacionPropias = async () => [{{ estado: 'Recibida' }}];
            await C.obtenerMios({{ onSuccess: (d) => {{ r.ok = d; }}, onError: (m) => {{ r.error = m; }} }});
            return r;""")
        self.assertEqual(res['ok']['avance']['horas'], 18)
        self.assertEqual(res['ok']['solicitudes'], [{'estado': 'Recibida'}])


class EliminacionHU06(unittest.TestCase):
    """SC001-HU06: constancia de la solicitud ligada a la identidad del joven."""

    def solicitar(self, motivo, con_sesion=True):
        return ejecutar_js(CTRL, f"""{SESION if con_sesion else 'A.getSesion = () => null;'} {CB}
            const llamadas = []; M.solicitarEliminacion = async (d) => {{ llamadas.push(d); return 'sol-1'; }};
            await C.solicitarEliminacion({motivo!r}, cb);
            return {{ r, llamadas, textos: I }};""")

    def test_registra_constancia_con_identidad_del_perfil(self):
        res = self.solicitar('  Ya no   participo ')
        self.assertEqual(res['r']['ok'], 'sol-1')
        self.assertEqual(res['llamadas'], [{'uid_estudiante': 'joven-1', 'nombre_estudiante': 'Ana Diaz Ruiz',
                                            'numero_documento': '123', 'motivo': 'Ya no participo'}])

    def test_motivo_opcional_y_limitado_a_500(self):
        self.assertIsNone(self.solicitar('   ')['llamadas'][0]['motivo'])
        self.assertEqual(len(self.solicitar('x' * 600)['llamadas'][0]['motivo']), 500)

    def test_sin_sesion_no_se_registra_nada(self):
        res = self.solicitar('motivo', con_sesion=False)
        self.assertEqual(res['r']['error'], res['textos']['auth']['accesoDenegado'])
        self.assertEqual(res['llamadas'], [])

    def test_el_mensaje_no_afirma_que_los_datos_se_borraron(self):
        textos = ejecutar_js({'I': 'js/config/i18n.js'}, 'return I.certificados;')
        self.assertIn('aún no han sido eliminados', textos['eliminacionOk'])


class FinalizacionYEnlacesJAL029a033(unittest.TestCase):
    """E03: carta de finalización y protección de enlaces de Drive."""

    def pedir_finalizacion(self, tramite):
        return ejecutar_js(TRAMITE, f"""A.getSesion = () => ({{ uid: 'joven-1' }}); {CB}
            const llamadas = []; AM.solicitarFinalizacion = async (id) => llamadas.push(id);
            await R.solicitarFinalizacion('t1', {tramite}, cb);
            return {{ r, llamadas, textos: I.tramite }};""")

    def test_solo_con_carta_inicial_expedida_y_una_vez_JAL029(self):
        ok = self.pedir_finalizacion("{ uid_estudiante: 'joven-1', estado: 'Expedida' }")
        self.assertEqual(ok['llamadas'], ['t1'])
        pendiente = self.pedir_finalizacion("{ uid_estudiante: 'joven-1', estado: 'Aprobado' }")
        self.assertEqual(pendiente['r']['error'], pendiente['textos']['errorFinalizacionNoDisponible'])
        repetida = self.pedir_finalizacion("{ uid_estudiante: 'joven-1', estado: 'Expedida', finalizacion_estado: 'Rechazada' }")
        self.assertEqual(repetida['r']['error'], repetida['textos']['errorFinalizacionYaSolicitada'])
        ajena = self.pedir_finalizacion("{ uid_estudiante: 'otro', estado: 'Expedida' }")
        self.assertEqual(ajena['llamadas'], [])

    def test_observaciones_de_rechazo_normalizadas_JAL031(self):
        res = ejecutar_js(TRAMITE, "return [AM._normalizarSugerencia('  Falta \\n la   firma '), AM._normalizarSugerencia('x'.repeat(1200)).length];")
        self.assertEqual(res, ['Falta la firma', 1000])

    def test_el_estudiante_nunca_recibe_enlaces_de_drive_JAL032(self):
        res = ejecutar_js(TRAMITE, """return AM._ocultarDocumentosPrivados({ id: 't1', estado: 'Expedida',
            documento_expedido_id: 'f1', documento_expedido_url: 'https://drive/x',
            documento_finalizacion_id: 'f2', documento_finalizacion_url: 'https://drive/y' });""")
        self.assertEqual(res['estado'], 'Expedida')
        for campo in ('documento_expedido_id', 'documento_expedido_url', 'documento_finalizacion_id', 'documento_finalizacion_url'):
            self.assertIsNone(res[campo], campo)
    # JAL-033 (migración) escribe en Firestore: se prueba en tests/integration/tramites.test.cjs con el emulador.


if __name__ == '__main__':
    unittest.main()
