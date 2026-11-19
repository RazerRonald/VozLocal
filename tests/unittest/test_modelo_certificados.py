"""CertificadoModel (E04 · SC001-HU01 a HU06) contra un Firestore simulado.

Las funciones de Firestore del CDN se reemplazan con globalThis.__cdn (ver
simular_cdn_hooks.mjs): cada escritura queda registrada en `ops` y las lecturas
devuelven los datos que define cada prueba.

Ejecutar desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import unittest

from puente import ejecutar_js

MODELO = {'M': 'js/models/CertificadoModel.js'}

# Firestore falso: registra escrituras y sirve lecturas desde `datos`, `partes` y `estados`.
FIRESTORE = """
const ops = []; let autoId = 0;
const datos = {}; const partes = {}; const estados = {};
const ts = (ms) => ({ toMillis: () => ms });
globalThis.__cdn = {
  collection: (_db, nombre) => ({ coleccion: nombre }),
  doc: (a, coleccion, id) => (coleccion === undefined
    ? { coleccion: a.coleccion, id: `auto-${++autoId}` }
    : { coleccion, id }),
  writeBatch: () => ({
    set: (ref, d) => ops.push(['set', ref.coleccion, ref.id, d]),
    update: (ref, d) => ops.push(['update', ref.coleccion, ref.id, d]),
    commit: async () => { ops.push(['commit']); },
  }),
  serverTimestamp: () => 'TS',
  query: (col, ...condiciones) => ({ coleccion: col.coleccion, condiciones }),
  where: (...a) => ['where', ...a],
  orderBy: (...a) => ['orderBy', ...a],
  getDocs: async (q) => { ops.push(['getDocs', q.coleccion, q.condiciones]);
    return { docs: (datos[q.coleccion] || []).map((d) => ({ id: d.id, data: () => d })) }; },
  getDoc: async (ref) => ({ exists: () => ref.id in partes, data: () => ({ datos: partes[ref.id] }) }),
  addDoc: async (col, d) => { ops.push(['add', col.coleccion, d]); return { id: 'sol-1' }; },
  runTransaction: async (_db, fn) => fn({
    get: async (ref) => ({ exists: () => ref.id in estados, data: () => ({ estado: estados[ref.id] }) }),
    update: (ref, d) => ops.push(['tx.update', ref.id, d]),
  }),
};
"""


def correr(codigo):
    return ejecutar_js(MODELO, FIRESTORE + codigo)


class RegistroYCorreccion(unittest.TestCase):
    """HU01 y HU03: el certificado y su archivo se escriben en un solo lote."""

    def test_registrar_crea_pendiente_con_cero_horas_y_sus_partes(self):
        r = correr("""
            const id = await M.registrar({ uid_estudiante: 'u1', actividad: 'A', terminos_menor_aceptados: true }, ['p0', 'p1']);
            return { id, ops };""")
        self.assertEqual(r['id'], 'auto-1')
        cert = r['ops'][0]
        self.assertEqual(cert[:3], ['set', 'certificados', 'auto-1'])
        self.assertEqual(cert[3]['estado'], 'Pendiente')
        self.assertEqual(cert[3]['horas_aprobadas'], 0)
        self.assertEqual(cert[3]['version'], 1)
        self.assertEqual(cert[3]['archivo_partes'], 2)
        self.assertEqual(cert[3]['fecha_aceptacion_terminos'], 'TS')
        self.assertIsNone(cert[3]['uid_revisor'])
        self.assertEqual([o[2] for o in r['ops'][1:3]], ['auto-1_v1_0', 'auto-1_v1_1'])
        self.assertEqual(r['ops'][2][3], {'uid_estudiante': 'u1', 'certificado_id': 'auto-1', 'version': 1, 'parte': 1, 'datos': 'p1'})
        self.assertEqual(r['ops'][-1], ['commit'])
        self.assertEqual(len(r['ops']), 4)

    def test_sin_terminos_del_menor_no_hay_constancia_de_aceptacion(self):
        r = correr("await M.registrar({ uid_estudiante: 'u1', terminos_menor_aceptados: false }, ['p0']); return ops;")
        self.assertIsNone(r[0][3]['fecha_aceptacion_terminos'])

    def test_corregir_sube_la_version_vuelve_a_pendiente_y_guarda_el_archivo_nuevo(self):
        r = correr("""
            await M.corregir({ id: 'c1', version: 2, uid_estudiante: 'u1' }, { actividad: 'B' }, ['q0']);
            return ops;""")
        self.assertEqual(r[0][:3], ['update', 'certificados', 'c1'])
        cambios = r[0][3]
        self.assertEqual((cambios['estado'], cambios['version'], cambios['actividad']), ('Pendiente', 3, 'B'))
        self.assertIsNone(cambios['motivo_rechazo'])
        self.assertFalse(cambios['revertido'])
        self.assertEqual(r[1][:3], ['set', 'certificados_archivos', 'c1_v3_0'])
        self.assertEqual(r[1][3]['version'], 3)
        self.assertEqual(r[-1], ['commit'])


class Consultas(unittest.TestCase):
    """HU02 y HU05: listados propios y del revisor, y lectura del archivo."""

    def test_listar_propios_filtra_por_joven_y_ordena_del_mas_reciente(self):
        r = correr("""
            datos.certificados = [{ id: 'a', fecha_carga: ts(1) }, { id: 'b', fecha_carga: ts(3) }, { id: 'c' }];
            const lista = await M.listarPropios('u1');
            return { ids: lista.map((c) => c.id), consulta: ops[0] };""")
        self.assertEqual(r['ids'], ['b', 'a', 'c'])
        self.assertEqual(r['consulta'], ['getDocs', 'certificados', [['where', 'uid_estudiante', '==', 'u1']]])

    def test_listar_todos_ordena_por_fecha_en_la_consulta(self):
        r = correr("""
            datos.certificados = [{ id: 'x', estado: 'Pendiente' }];
            const lista = await M.listarTodos();
            return { lista, consulta: ops[0] };""")
        self.assertEqual(r['lista'], [{'id': 'x', 'estado': 'Pendiente'}])
        self.assertEqual(r['consulta'][2], [['orderBy', 'fecha_carga', 'desc']])

    def test_leer_archivo_une_las_partes_de_la_version_vigente(self):
        r = correr("""
            Object.assign(partes, { c1_v2_0: 'AAA', c1_v2_1: 'BBB', c1_v1_0: 'viejo' });
            return await M.leerArchivo({ id: 'c1', version: 2, archivo_partes: 2 });""")
        self.assertEqual(r, 'AAABBB')

    def test_leer_archivo_incompleto_avisa_con_un_codigo(self):
        r = correr("""
            partes.c1_v1_0 = 'AAA';
            try { await M.leerArchivo({ id: 'c1', version: 1, archivo_partes: 2 }); return 'sin error'; }
            catch (e) { return e.code; }""")
        self.assertEqual(r, 'certificado/archivo-incompleto')


class Revision(unittest.TestCase):
    """HU02 y HU04: la transacción relee el estado antes de cambiarlo."""

    def revisar(self, estado_actual, llamada):
        return correr(f"""
            {'' if estado_actual is None else f"estados.c1 = '{estado_actual}';"}
            try {{ await M.{llamada}; return {{ ops }}; }}
            catch (e) {{ return {{ ops, error: e.code }}; }}""")

    def test_aprobar_un_pendiente_guarda_horas_y_revisor(self):
        r = self.revisar('Pendiente', "aprobar('c1', 18, 'edil-1')")
        self.assertEqual(r['ops'], [['tx.update', 'c1', {'estado': 'Aprobado', 'horas_aprobadas': 18, 'fecha_revision': 'TS', 'uid_revisor': 'edil-1'}]])

    def test_rechazar_un_pendiente_guarda_el_motivo(self):
        r = self.revisar('Pendiente', "rechazar('c1', 'Falta firma', 'edil-1')")
        self.assertEqual(r['ops'][0][2]['estado'], 'Rechazado')
        self.assertEqual(r['ops'][0][2]['motivo_rechazo'], 'Falta firma')

    def test_revertir_un_aprobado_deja_cero_horas_y_marca_la_reversion(self):
        r = self.revisar('Aprobado', "revertir('c1', 'Error', 'edil-1')")
        cambios = r['ops'][0][2]
        self.assertEqual((cambios['estado'], cambios['horas_aprobadas'], cambios['revertido']), ('Rechazado', 0, True))

    def test_si_el_estado_ya_cambio_no_se_vuelve_a_aplicar(self):
        for estado, llamada in (('Aprobado', "aprobar('c1', 5, 'e')"), ('Rechazado', "revertir('c1', 'x', 'e')"), (None, "rechazar('c1', 'x', 'e')")):
            with self.subTest(estado=estado, llamada=llamada):
                r = self.revisar(estado, llamada)
                self.assertEqual(r['error'], 'certificado/estado-cambiado')
                self.assertEqual(r['ops'], [])


class SolicitudesDeEliminacion(unittest.TestCase):
    """HU06: se deja constancia; no se borra nada."""

    def test_solicitar_eliminacion_registra_constancia_recibida(self):
        r = correr("""
            const id = await M.solicitarEliminacion({ uid_estudiante: 'u1', motivo: null });
            return { id, op: ops[0] };""")
        self.assertEqual(r['id'], 'sol-1')
        self.assertEqual(r['op'], ['add', 'solicitudes_eliminacion', {'uid_estudiante': 'u1', 'motivo': None, 'estado': 'Recibida', 'fecha_solicitud': 'TS'}])

    def test_listados_de_solicitudes_propias_y_del_edil(self):
        r = correr("""
            datos.solicitudes_eliminacion = [{ id: 's1', fecha_solicitud: ts(5) }, { id: 's2', fecha_solicitud: ts(9) }];
            const propias = await M.listarSolicitudesEliminacionPropias('u1');
            const todas = await M.listarSolicitudesEliminacion();
            return { propias: propias.map((s) => s.id), todas: todas.map((s) => s.id), consultas: ops.map((o) => o[2]) };""")
        self.assertEqual(r['propias'], ['s2', 's1'])
        self.assertEqual(r['todas'], ['s1', 's2'])
        self.assertEqual(r['consultas'], [[['where', 'uid_estudiante', '==', 'u1']], [['orderBy', 'fecha_solicitud', 'desc']]])


if __name__ == '__main__':
    unittest.main()
