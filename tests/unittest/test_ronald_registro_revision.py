"""PR 1 · Ronald Briceño — JAL-020 a JAL-024 y SC001-HU01, SC001-HU02.
(HU01: minoría de edad por fecha de nacimiento y términos del menor.)

Ejecutar desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import re
import unittest

from puente import ejecutar_js, leer

UTIL = {'U': 'js/utils/certificados.js'}
CTRL = {'C': 'js/controllers/CertificadoController.js', 'A': 'js/models/AuthModel.js',
        'M': 'js/models/CertificadoModel.js', 'I': 'js/config/i18n.js'}
TRAMITE = {'R': 'js/controllers/ArchivoController.js'}

# Fragmentos JS reutilizados: archivos de prueba, sesión simulada y espía del modelo.
PDF = """const pdf = (n) => { const b = new Uint8Array(n).fill(32);
  b.set([...'%PDF-1.4\\n'].map((c) => c.charCodeAt(0)));
  b.set([...'\\n%%EOF\\n'].map((c) => c.charCodeAt(0)), n - 7); return b; };"""
SESION = """A.getSesion = () => ({ uid: 'joven-1', rol: 'estudiante', nombre: 'Ana Diaz Ruiz', nombre_perfil: 'Ana',
  primer_apellido: 'Diaz', segundo_apellido: 'Ruiz', tipo_documento: 'CC', numero_documento: '123', ciudad_documento: 'Medellin' });"""
ESPIA = """const llamadas = []; const r = {};
const cb = { onLoading() {}, onSuccess() { r.ok = true; }, onError(m) { r.error = m; } };"""
FORM = """const form = { actividad: 'Apoyo biblioteca', entidad: 'JAL', horas_reportadas: '20', consentimiento_joven: 'on',
  fecha_nacimiento: '1990-05-10' };
const haceAnios = (n, dias = 0) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - n);
  d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };"""


class ValidacionArchivoHU01(unittest.TestCase):
    """SC001-HU01 criterios 3 y 4: formato, tamaño e integridad del archivo."""

    def validar(self, expresion):
        return ejecutar_js(UTIL, f'{PDF} return U.validarArchivoCertificado({expresion});')

    def test_acepta_pdf_png_y_jpg_completos(self):
        self.assertEqual(self.validar('pdf(2000)'), {'ok': True, 'tipo': 'application/pdf'})
        png = 'Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,0,0,0,0,0,0,0,0,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82])'
        self.assertEqual(self.validar(png), {'ok': True, 'tipo': 'image/png'})
        self.assertEqual(self.validar('Uint8Array.from([0xff,0xd8,0xff,0xe0,1,2,0xff,0xd9])'), {'ok': True, 'tipo': 'image/jpeg'})

    def test_limite_de_5_mb_exactos(self):
        self.assertTrue(self.validar('pdf(5 * 1024 * 1024)')['ok'])
        self.assertEqual(self.validar('pdf(5 * 1024 * 1024 + 1)')['error'], 'tamano')

    def test_rechaza_vacio_otro_formato_y_truncado(self):
        self.assertEqual(self.validar('new Uint8Array(0)')['error'], 'vacio')
        self.assertEqual(self.validar("new TextEncoder().encode('hola, no soy pdf')")['error'], 'formato')
        self.assertEqual(self.validar('pdf(2000).subarray(0, 900)')['error'], 'corrupto')

    def test_archivo_de_5_mb_se_parte_en_10_trozos_y_se_reconstruye(self):
        r = ejecutar_js(UTIL, f"""{PDF} const original = pdf(5 * 1024 * 1024);
            const partes = U.partirEnTrozos(U.bytesABase64(original));
            const copia = U.base64ABytes(partes.join(''));
            return {{ partes: partes.length, igual: copia.length === original.length && copia.every((b, i) => b === original[i]) }};""")
        self.assertEqual(r, {'partes': 10, 'igual': True})


class CargaCertificadoHU01(unittest.TestCase):
    """SC001-HU01: consentimientos y que un intento inválido no escriba nada."""

    def cargar(self, ajuste_form='', archivo="new File([pdf(2000)], 'cert.pdf')"):
        return ejecutar_js(CTRL, f"""{PDF} {SESION} {ESPIA} {FORM} {ajuste_form}
            M.registrar = async (datos, partes) => {{ llamadas.push({{ datos, partes: partes.length }}); return 'nuevo'; }};
            await C.cargar(form, {archivo}, cb);
            return {{ r, llamadas, textos: I.certificados }};""")

    def test_carga_valida_usa_identidad_del_perfil_y_cero_horas(self):
        res = self.cargar()
        self.assertTrue(res['r'].get('ok'))
        datos = res['llamadas'][0]['datos']
        self.assertEqual(datos['uid_estudiante'], 'joven-1')
        self.assertEqual(datos['nombre_estudiante'], 'Ana Diaz Ruiz')
        self.assertEqual(datos['numero_documento'], '123')
        self.assertEqual(datos['archivo_tipo'], 'application/pdf')
        self.assertEqual(datos['archivo_tamano'], 2000)
        self.assertNotIn('horas_aprobadas', datos)  # el modelo lo fija en 0 al crear

    def test_sin_consentimiento_del_joven_no_se_guarda(self):
        res = self.cargar("delete form.consentimiento_joven;")
        self.assertEqual(res['r']['error'], res['textos']['errorConsentimientoJoven'])
        self.assertEqual(res['llamadas'], [])

    def test_menor_se_detecta_por_la_fecha_y_exige_tutor_y_terminos(self):
        menor = "form.fecha_nacimiento = haceAnios(15);"
        res = self.cargar(menor)
        self.assertEqual(res['r']['error'], res['textos']['errorTutorNombre'])
        self.assertEqual(res['llamadas'], [])
        res = self.cargar(menor + " form.acudiente_nombre = 'Rosa Ruiz';")
        self.assertEqual(res['r']['error'], res['textos']['errorTerminosMenor'])
        self.assertEqual(res['llamadas'], [])
        res = self.cargar(menor + " form.acudiente_nombre = 'Rosa Ruiz'; form.terminos_menor_aceptados = 'si';")
        self.assertTrue(res['r'].get('ok'))
        datos = res['llamadas'][0]['datos']
        self.assertTrue(datos['es_menor'])
        self.assertTrue(datos['terminos_menor_aceptados'])
        self.assertEqual(datos['acudiente_nombre'], 'Rosa Ruiz')

    def test_el_dia_que_cumple_18_ya_no_es_menor(self):
        res = self.cargar("form.fecha_nacimiento = haceAnios(18);")
        self.assertTrue(res['r'].get('ok'))
        self.assertFalse(res['llamadas'][0]['datos']['es_menor'])
        res = self.cargar("form.fecha_nacimiento = haceAnios(18, 1);")
        self.assertEqual(res['r']['error'], res['textos']['errorTutorNombre'])

    def test_un_mayor_no_puede_marcarse_menor_ni_guardar_datos_de_tutor(self):
        res = self.cargar("form.es_menor = 'on'; form.acudiente_nombre = 'X'; form.terminos_menor_aceptados = 'si';")
        self.assertTrue(res['r'].get('ok'))
        datos = res['llamadas'][0]['datos']
        self.assertEqual(datos['fecha_nacimiento'], '1990-05-10')
        self.assertFalse(datos['es_menor'])
        self.assertFalse(datos['terminos_menor_aceptados'])
        self.assertIsNone(datos['acudiente_nombre'])

    def test_fecha_de_nacimiento_faltante_invalida_o_futura_no_se_guarda(self):
        for ajuste in ("delete form.fecha_nacimiento;", "form.fecha_nacimiento = '2007-02-30';",
                       "form.fecha_nacimiento = haceAnios(-1);"):
            with self.subTest(ajuste=ajuste):
                res = self.cargar(ajuste)
                self.assertEqual(res['r']['error'], res['textos']['errorFechaNacimiento'])
                self.assertEqual(res['llamadas'], [])

    def test_el_formulario_pide_fecha_y_terminos_en_vez_de_casilla_de_menor(self):
        vista = leer('js/views/CertificadosView.js')
        self.assertIn('type="date" id="cert-fecha-nacimiento" name="fecha_nacimiento"', vista)
        self.assertIn('name="terminos_menor_aceptados"', vista)
        self.assertIn('id="modal-terminos-menor"', vista)
        self.assertNotIn('name="es_menor"', vista)
        reglas = leer('firestore.rules')
        self.assertIn("data.es_menor == !cumplidosAnios(data.fecha_nacimiento, 18)", reglas)

    def test_archivo_invalido_no_escribe_nada(self):
        res = self.cargar(archivo="new File([new TextEncoder().encode('texto')], 'notas.txt')")
        self.assertEqual(res['r']['error'], res['textos']['erroresArchivo']['formato'])
        self.assertEqual(res['llamadas'], [])

    def test_horas_reportadas_invalidas(self):
        res = self.cargar("form.horas_reportadas = '0';")
        self.assertEqual(res['r']['error'], res['textos']['errorHoras'])


class RevisionCertificadoHU02(unittest.TestCase):
    """SC001-HU02: aprobar con horas verificadas o rechazar con motivo."""

    def revisar(self, accion, valor):
        return ejecutar_js(CTRL, f"""{SESION} {ESPIA}
            M.aprobar = async (...a) => llamadas.push(['aprobar', ...a]);
            M.rechazar = async (...a) => llamadas.push(['rechazar', ...a]);
            await C.{accion}({{ id: 'c1', horas_reportadas: 20 }}, {valor!r}, cb);
            return {{ r, llamadas, textos: I.certificados }};""")

    def test_aprueba_con_horas_verificadas_dentro_de_lo_reportado(self):
        res = self.revisar('aprobar', '18')
        self.assertEqual(res['llamadas'], [['aprobar', 'c1', 18, 'joven-1']])

    def test_no_aprueba_mas_horas_de_las_reportadas_ni_cero(self):
        for horas in ('21', '0', 'abc'):
            with self.subTest(horas=horas):
                res = self.revisar('aprobar', horas)
                self.assertIn('no superar 20', res['r']['error'])
                self.assertEqual(res['llamadas'], [])

    def test_rechazo_exige_motivo_y_lo_normaliza(self):
        res = self.revisar('rechazar', '   ')
        self.assertEqual(res['r']['error'], res['textos']['errorMotivo'])
        res = self.revisar('rechazar', '  Falta   la firma ')
        self.assertEqual(res['llamadas'], [['rechazar', 'c1', 'Falta la firma', 'joven-1']])

    def test_mensajes_de_error_claros(self):
        res = ejecutar_js(CTRL, """return [C._mensajeError({ code: 'certificado/estado-cambiado' }),
            C._mensajeError({ code: 'permission-denied' }), I.certificados];""")
        self.assertEqual(res[0], res[2]['errorEstadoCambiado'])
        self.assertEqual(res[1], res[2]['errorPermiso'])


class TramitesJAL020a024(unittest.TestCase):
    """E03: solicitud con identidad del perfil y aprobación antes de expedir."""

    def test_solicitud_toma_identidad_de_la_sesion_JAL021(self):
        datos = ejecutar_js(TRAMITE, """return R._normalizarFormulario(
            { universidad: ' UdeA ', carrera: 'Software', semestre_actual: '5', horas_a_realizar: '80', lugar_realizacion: 'JAL',
              nombre_completo: 'Intruso' },
            { nombre_perfil: 'Ana', primer_apellido: 'Diaz', segundo_apellido: 'Ruiz', tipo_documento: 'CC',
              numero_documento: '123', ciudad_documento: 'Medellin' });""")
        self.assertEqual(datos['nombre_completo'], 'Ana Diaz Ruiz')
        self.assertEqual(datos['universidad'], 'UdeA')
        self.assertEqual(datos['semestre_actual'], 5)

    def test_validacion_de_la_solicitud_JAL020(self):
        res = ejecutar_js(TRAMITE, """const base = { nombre_completo: 'Ana', tipo_documento: 'CC', numero_documento: '1',
              ciudad_documento: 'M', universidad: 'U', carrera: 'C', lugar_realizacion: 'L', semestre_actual: 5, horas_a_realizar: 80 };
            return [R._validarFormulario(base), R._validarFormulario({ ...base, semestre_actual: NaN }),
                    R._validarFormulario({ ...base, horas_a_realizar: 0 }), R._validarFormulario({ ...base, carrera: '' })];""")
        self.assertIsNone(res[0])
        self.assertTrue(all(res[1:]))

    def test_vista_previa_para_expedir_solo_en_tramites_aprobados_JAL023(self):
        vista = leer('js/views/AdminView.js')
        self.assertRegex(vista, r"t\.estado === ESTADOS_TRAMITE\.APROBADO \? `\s*<button class=\"btn btn-sm btn-jal-primary btn-vista-previa\"")
        reglas = leer('firestore.rules')
        self.assertIn("(antes == 'Aprobado' && despues == 'Expedida')", reglas)
        self.assertTrue(re.search(r'&& transicionEstadoTramiteValida\(\)', reglas))


if __name__ == '__main__':
    unittest.main()
