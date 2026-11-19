"""Validación de correos y creación de usuarios por el Edil (correcciones de SonarCloud).

- La expresión de correo sin retroceso (S8786) en AuthController,
  SolicitudAccesoController y ArchivoModel acepta correos válidos, rechaza
  dominios mal formados y responde rápido con entradas largas.
- AuthModel.crearUsuarioPorEdil usa crypto.randomUUID() (S2245) para el nombre
  de la app secundaria de Firebase, que se crea y se elimina en cada alta.

Ejecutar desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import unittest

from puente import ejecutar_js

VALIDOS = ['ana@example.test', 'a.b+c@uni.edu.co', 'x@y.z']
INVALIDOS = ['sin-arroba.com', 'a@b', 'a b@c.d', 'a@b..c', 'a@.b.c', 'a@b.c.', '@b.c', 'a@@b.c']

CORREO = {'AC': 'js/controllers/AuthController.js', 'SC': 'js/controllers/SolicitudAccesoController.js',
          'AM': 'js/models/ArchivoModel.js', 'A': 'js/models/AuthModel.js', 'I': 'js/config/i18n.js'}

PERFIL = """const perfil = (email) => ({ email, nombre: 'Ana', primer_apellido: 'Diaz', segundo_apellido: 'Ruiz',
  tipo_documento: 'CC', numero_documento: '12345678', ciudad_documento: 'Medellin' });"""


class ValidacionDeCorreo(unittest.TestCase):
    """S8786: misma respuesta para correos válidos, más estricta con dominios mal formados."""

    def evaluar(self, correos):
        return ejecutar_js(CORREO, f"""{PERFIL}
            const invalidoAdmin = I.admin.usuariosEmailInvalido; const invalidoSolicitud = I.solicitudAcceso.emailInvalido;
            return {repr(correos)}.map((c) => ({{
              admin: AC._validarPerfil(perfil(c)) !== invalidoAdmin,
              solicitud: SC._validar(perfil(c)) !== invalidoSolicitud,
              drive: AM._normalizarCorreo(c) === c,
            }}));""")

    def test_acepta_correos_validos_en_los_tres_lugares(self):
        for correo, r in zip(VALIDOS, self.evaluar(VALIDOS)):
            with self.subTest(correo=correo):
                self.assertEqual(r, {'admin': True, 'solicitud': True, 'drive': True})

    def test_rechaza_correos_y_dominios_mal_formados(self):
        for correo, r in zip(INVALIDOS, self.evaluar(INVALIDOS)):
            with self.subTest(correo=correo):
                self.assertEqual(r, {'admin': False, 'solicitud': False, 'drive': False})

    def test_restablecer_contrasena_exige_un_correo_valido(self):
        res = ejecutar_js(CORREO, """
            const enviados = []; const errores = [];
            A.enviarResetPassword = async (email) => enviados.push(email);
            const cb = { onError: (m) => errores.push(m), onSuccess: () => {}, onLoading: () => {} };
            await AC.enviarCorreoRestablecerPassword('a@b..c', cb);
            await AC.enviarCorreoRestablecerPassword('  ana@example.test ', cb);
            return { enviados, errores, esperado: I.auth.resetIngresaCorreo };""")
        self.assertEqual(res['enviados'], ['ana@example.test'])
        self.assertEqual(res['errores'], [res['esperado']])

    def test_entrada_larga_se_evalua_rapido(self):
        ms = ejecutar_js(CORREO, PERFIL + """const largo = 'a@' + 'b.'.repeat(50000) + '!';
            const inicio = Date.now(); AC._validarPerfil(perfil(largo)); SC._validar(perfil(largo)); AM._normalizarCorreo(largo);
            return Date.now() - inicio;""")
        self.assertLess(ms, 500)


AUTH = {'A': 'js/models/AuthModel.js'}

# Firebase simulado: registra cada llamada y permite forzar fallos.
FIREBASE = """
const llamadas = []; const fallar = {};
const registrar = (nombre, valor) => (...args) => { llamadas.push([nombre, ...args.filter((a) => typeof a === 'string')]);
  if (fallar[nombre]) throw Object.assign(new Error(nombre), { code: fallar[nombre] }); return valor; };
globalThis.__cdn = {
  initializeApp: (_cfg, nombre) => { llamadas.push(['initializeApp', nombre]); return { nombre }; },
  getAuth: (app) => ({ app: app.nombre }),
  setPersistence: async () => {},
  createUserWithEmailAndPassword: async (_auth, email) => { llamadas.push(['createUser', email]);
    if (fallar.createUser) throw Object.assign(new Error('x'), { code: fallar.createUser });
    return { user: { uid: 'nuevo-uid' } }; },
  updateProfile: async (_u, datos) => llamadas.push(['updateProfile', datos.displayName]),
  setDoc: async (ref, datos) => { llamadas.push(['setDoc', ref.id, datos.rol]); if (fallar.setDoc) throw new Error('setDoc'); },
  deleteUser: async (u) => llamadas.push(['deleteUser', u.uid]),
  signOut: async () => llamadas.push(['signOut']),
  deleteApp: async (app) => llamadas.push(['deleteApp', app.nombre]),
  doc: (_db, coleccion, id) => ({ coleccion, id }),
  collection: () => ({}), query: () => ({}), where: () => ({}), limit: () => ({}),
  getDocs: async () => ({ docs: [] }),
  serverTimestamp: () => 'TS',
};
A.getSesion = () => ({ uid: 'edil-1', rol: 'edil' });
const datos = { email: ' Ana@Example.test ', password: 'secreta1234', rol: 'estudiante', nombre: 'Ana', primer_apellido: 'Diaz',
  segundo_apellido: 'Ruiz', tipo_documento: 'CC', numero_documento: '12345678', ciudad_documento: 'Medellin' };
"""


class CrearUsuarioPorEdil(unittest.TestCase):
    """S2245: nombre único y aleatorio seguro para la app secundaria de Firebase."""

    def test_crea_el_usuario_con_una_app_secundaria_unica_y_la_elimina(self):
        res = ejecutar_js(AUTH, FIREBASE + """
            const u1 = await A.crearUsuarioPorEdil(datos);
            const u2 = await A.crearUsuarioPorEdil(datos);
            return { llamadas, uid: u1.uid, rol: u2.rol };""")
        apps = [c[1] for c in res['llamadas'] if c[0] == 'initializeApp']
        self.assertEqual(len(apps), 2)
        self.assertNotEqual(apps[0], apps[1])
        for nombre in apps:
            self.assertRegex(nombre, r'^admin-create-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        self.assertIn(['createUser', 'ana@example.test'], res['llamadas'])
        self.assertIn(['setDoc', 'nuevo-uid', 'estudiante'], res['llamadas'])
        self.assertEqual([c[1] for c in res['llamadas'] if c[0] == 'deleteApp'], apps)
        self.assertEqual(res['uid'], 'nuevo-uid')

    def test_si_falla_el_perfil_revierte_el_usuario_de_auth(self):
        res = ejecutar_js(AUTH, FIREBASE + """
            fallar.setDoc = true;
            try { await A.crearUsuarioPorEdil(datos); return { llamadas, error: null }; }
            catch (e) { return { llamadas, error: e.message }; }""")
        self.assertEqual(res['error'], 'setDoc')
        self.assertIn(['deleteUser', 'nuevo-uid'], res['llamadas'])
        self.assertEqual(res['llamadas'][-1][0], 'deleteApp')

    def test_solo_un_edil_puede_crear_usuarios_y_sin_documento_duplicado(self):
        res = ejecutar_js(AUTH, FIREBASE + """
            const errores = [];
            A.getSesion = () => ({ uid: 'joven-1', rol: 'estudiante' });
            try { await A.crearUsuarioPorEdil(datos); } catch (e) { errores.push(e.code); }
            A.getSesion = () => ({ uid: 'edil-1', rol: 'edil' });
            globalThis.__cdn.getDocs = async () => ({ docs: [{ id: 'otro-uid' }] });
            try { await A.crearUsuarioPorEdil(datos); } catch (e) { errores.push(e.code); }
            return { errores, apps: llamadas.filter((c) => c[0] === 'initializeApp').length };""")
        self.assertEqual(res['errores'], ['auth/unauthorized', 'profile/document-duplicate'])
        self.assertEqual(res['apps'], 0)


if __name__ == '__main__':
    unittest.main()
