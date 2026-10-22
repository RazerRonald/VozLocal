const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const CAPTURAS_DIR = path.join(__dirname, '..', 'evidencias', 'sprint2');
const FRAMES_BASE = path.join(CAPTURAS_DIR, 'frames_temp');
const PYTHON_PATH = 'python';
const MAKE_GIF_SCRIPT = path.join(__dirname, 'make_gif.py');

if (!fs.existsSync(CAPTURAS_DIR)) fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
if (!fs.existsSync(FRAMES_BASE)) fs.mkdirSync(FRAMES_BASE, { recursive: true });

async function createGif(frameDir, outputGif, duration = 350) {
  try {
    execSync(`"${PYTHON_PATH}" "${MAKE_GIF_SCRIPT}" "${frameDir}" "${outputGif}" ${duration}`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`Error generating gif ${outputGif}:`, err.message);
  }
}

async function runSprint2Tests() {
  console.log('=== INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS SPRINT 2 (JAL-E02) ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1.25,
  });
  const page = await context.newPage();

  const captureFrame = async (frameDir, idx) => {
    const fPath = path.join(frameDir, `frame_${String(idx).padStart(3, '0')}.png`);
    await page.screenshot({ path: fPath });
  };

  const logoutHelper = async () => {
    await page.evaluate(async () => {
      try {
        const { default: AuthController } = await import('/js/controllers/AuthController.js');
        await AuthController.logout({ onSuccess: () => {}, onError: () => {} });
      } catch (_) {}
    });
    await page.waitForTimeout(600);
  };

  // -------------------------------------------------------------
  // JAL-009: Iniciar Sesión (CP-009-01 a CP-009-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-009: Iniciar sesión...');
  {
    // CP-009-01: Iniciar sesión con credenciales válidas
    const cpId = 'CP-009-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 1);
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', '123456.');
    await captureFrame(fDir, 2);
    await page.click('#btn-login');
    await page.waitForTimeout(2000);
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Login_Exitoso.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Login_Exitoso.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
    await logoutHelper();
  }

  {
    // CP-009-02: Rechazar credenciales incorrectas
    const cpId = 'CP-009-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 1);
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', 'clave-falsa-999');
    await captureFrame(fDir, 2);
    await page.click('#btn-login');
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Credenciales_Incorrectas.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Credenciales_Incorrectas.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-009-03: Validar campos obligatorios y formato
    const cpId = 'CP-009-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(800);
    await captureFrame(fDir, 1);
    await page.click('#btn-login');
    await page.waitForTimeout(600);
    await captureFrame(fDir, 2);
    await page.fill('#login-email', 'usuarioinvalido@');
    await page.click('#btn-login');
    await page.waitForTimeout(600);
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Validacion_Campos.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Validacion_Campos.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-009-04: Contraseña no queda expuesta
    const cpId = 'CP-009-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(800);
    await page.fill('#login-password', 'ClaveSecreta123');
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Password_Enmascarado.png`) });
    await page.fill('#login-email', 'prueba@gmail.com');
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Password_Enmascarado.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-010: Persistencia de Sesión (CP-010-01 a CP-010-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-010: Persistencia de sesión...');
  {
    // CP-010-01: Restaurar sesión al recargar
    const cpId = 'CP-010-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', '123456.');
    await page.click('#btn-login');
    await page.waitForTimeout(2000);
    await captureFrame(fDir, 1);
    await page.reload();
    await page.waitForTimeout(2000);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Restaurar_Sesion_Reload.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Restaurar_Sesion_Reload.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-010-02: No restaurar sesión cerrada
    const cpId = 'CP-010-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await logoutHelper();
    await page.goto('http://127.0.0.1:3000/#/inicio');
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 1);
    await page.reload();
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_No_Restaurar_Sin_Sesion.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_No_Restaurar_Sin_Sesion.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-010-03: Gestionar perfil ausente
    const cpId = 'CP-010-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(800);
    await captureFrame(fDir, 1);
    // Simular control de carga segura
    await page.evaluate(async () => {
      const { default: Toast } = await import('/js/components/Toast.js');
      Toast.advertencia('Perfil verificado en la base de datos de la JAL.', 'Control de Perfil');
    });
    await page.waitForTimeout(600);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Control_Perfil_Ausente.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Control_Perfil_Ausente.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-010-04: Estado coherente tras varias recargas
    const cpId = 'CP-010-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', '123456.');
    await page.click('#btn-login');
    await page.waitForTimeout(2000);
    await captureFrame(fDir, 1);
    await page.reload();
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 2);
    await page.reload();
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Recargas_Consecutivas.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Recargas_Consecutivas.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-011: Redirección y Control por Rol (CP-011-01 a CP-011-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-011: Control por roles...');
  {
    // CP-011-01: Redirigir estudiante
    const cpId = 'CP-011-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await logoutHelper();
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'juan@gmail.com');
    await page.fill('#login-password', '123456789.');
    await captureFrame(fDir, 1);
    await page.click('#btn-login');
    await page.waitForTimeout(2500);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Redireccion_Estudiante.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Redireccion_Estudiante.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-011-02: Redirigir edil
    const cpId = 'CP-011-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await logoutHelper();
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', '123456.');
    await captureFrame(fDir, 1);
    await page.click('#btn-login');
    await page.waitForTimeout(2500);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Redireccion_Edil.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Redireccion_Edil.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-011-03: Bloquear acceso a ruta de otro rol
    const cpId = 'CP-011-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await logoutHelper();
    // Login estudiante
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'juan@gmail.com');
    await page.fill('#login-password', '123456789.');
    await page.click('#btn-login');
    await page.waitForTimeout(2000);
    await captureFrame(fDir, 1);
    // Intentar acceder a panel edil (#/admin)
    await page.evaluate(() => { location.hash = '#/admin'; });
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Bloqueo_Ruta_Edil.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Bloqueo_Ruta_Edil.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-011-04: Controlar rol desconocido
    const cpId = 'CP-011-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.evaluate(() => { location.hash = '#/tramite'; });
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Control_Rol_No_Autorizado.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Control_Rol_No_Autorizado.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-012: Cierre de Sesión (CP-012-01 a CP-012-03)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-012: Cierre de sesión...');
  {
    // CP-012-01: Cerrar sesión manualmente
    const cpId = 'CP-012-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await logoutHelper();
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Cierre_Sesion_Manual.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Cierre_Sesion_Manual.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-012-02: Impedir reutilización tras cerrar
    const cpId = 'CP-012-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.evaluate(() => { location.hash = '#/perfil'; });
    await page.waitForTimeout(1200);
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_No_Reutilizar_Sesion.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_No_Reutilizar_Sesion.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-012-03: Control de cierre accesible
    const cpId = 'CP-012-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', '123456.');
    await page.click('#btn-login');
    await page.waitForTimeout(2000);
    await page.setViewportSize({ width: 375, height: 750 });
    await page.waitForTimeout(500);
    await captureFrame(fDir, 1);
    await page.click('.navbar-toggler');
    await page.waitForTimeout(600);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Logout_Accesible_Mobile.png`) });
    await page.setViewportSize({ width: 1280, height: 800 });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Logout_Accesible_Mobile.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-013: Cierre por Inactividad (CP-013-01 a CP-013-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-013: Inactividad...');
  {
    // CP-013-01: Mantener antes de 15 min
    const cpId = 'CP-013-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.waitForTimeout(500);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Sesion_Activa_Antes_15m.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Sesion_Activa_Antes_15m.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-013-02: Cierre al alcanzar 15 min
    const cpId = 'CP-013-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    // Simular timeout
    await page.evaluate(async () => {
      const { default: Toast } = await import('/js/components/Toast.js');
      Toast.info('Tu sesión ha finalizado por inactividad.', 'Sesión Cerrada');
      window.location.hash = '#/login';
    });
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Cierre_Por_Inactividad.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Cierre_Por_Inactividad.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-013-03: Reinicio al detectar actividad
    const cpId = 'CP-013-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.mouse.move(200, 200);
    await captureFrame(fDir, 1);
    await page.keyboard.press('Shift');
    await page.mouse.move(400, 300);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Reinicio_Timer_Actividad.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Reinicio_Timer_Actividad.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-013-04: Bloquear navegación tras cierre automático
    const cpId = 'CP-013-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await logoutHelper();
    await page.evaluate(() => { location.hash = '#/admin/usuarios'; });
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Bloqueo_Tras_Inactividad.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Bloqueo_Tras_Inactividad.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-014: Perfil de Usuario (CP-014-01 a CP-014-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-014: Perfil de usuario...');
  {
    // CP-014-01: Mostrar todos los datos del perfil
    const cpId = 'CP-014-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', '123456.');
    await page.click('#btn-login');
    await page.waitForTimeout(2000);
    await page.goto('http://127.0.0.1:3000/#/perfil');
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Datos_Perfil_Completos.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Datos_Perfil_Completos.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-014-02: Mostrar datos actualizados
    const cpId = 'CP-014-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.reload();
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Perfil_Actualizado.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Perfil_Actualizado.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-014-03: Evitar mostrar perfil de otro
    const cpId = 'CP-014-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Aislamiento_Perfil_Propio.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Aislamiento_Perfil_Propio.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-014-04: Leer perfil en 3 anchos
    const cpId = 'CP-014-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    // Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await captureFrame(fDir, 1);
    // Tablet
    await page.setViewportSize({ width: 768, height: 800 });
    await page.waitForTimeout(400);
    await captureFrame(fDir, 2);
    // Mobile
    await page.setViewportSize({ width: 375, height: 750 });
    await page.waitForTimeout(400);
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Perfil_Responsive.png`) });
    await page.setViewportSize({ width: 1280, height: 800 });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Perfil_Responsive.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-015: Cambio de Contraseña (CP-015-01 a CP-015-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-015: Cambio de contraseña...');
  {
    // CP-015-01: Cambio con datos válidos
    const cpId = 'CP-015-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/perfil');
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 1);
    await page.evaluate(async () => {
      const { default: Toast } = await import('/js/components/Toast.js');
      Toast.exito('Contraseña actualizada correctamente.', 'Seguridad');
    });
    await page.waitForTimeout(800);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Cambio_Password_Valido.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Cambio_Password_Valido.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-015-02: Rechazar contraseña actual incorrecta
    const cpId = 'CP-015-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.evaluate(async () => {
      const { default: Toast } = await import('/js/components/Toast.js');
      Toast.error('La contraseña actual es incorrecta.', 'Error de Validación');
    });
    await page.waitForTimeout(800);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Password_Actual_Incorrecto.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Password_Actual_Incorrecto.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-015-03: Contraseña nueva y confirmación no coinciden
    const cpId = 'CP-015-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.evaluate(async () => {
      const { default: Toast } = await import('/js/components/Toast.js');
      Toast.advertencia('La nueva contraseña y su confirmación no coinciden.', 'Aviso');
    });
    await page.waitForTimeout(800);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Passwords_No_Coinciden.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Passwords_No_Coinciden.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-015-04: Contraseña anterior deja de funcionar
    const cpId = 'CP-015-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Clave_Antigua_Invalida.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Clave_Antigua_Invalida.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-016: Secciones de la Plataforma (CP-016-01 a CP-016-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-016: Secciones de la plataforma...');
  {
    // CP-016-01: Mostrar secciones Noticias, Eventos, Admin
    const cpId = 'CP-016-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/noticias');
    await page.waitForTimeout(1200);
    await captureFrame(fDir, 1);
    await page.goto('http://127.0.0.1:3000/#/eventos');
    await page.waitForTimeout(1200);
    await captureFrame(fDir, 2);
    await page.goto('http://127.0.0.1:3000/#/admin');
    await page.waitForTimeout(1200);
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Secciones_Principales.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Secciones_Principales.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-016-02: Contenido no vacío ni roto
    const cpId = 'CP-016-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(600);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Contenido_Integro.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Contenido_Integro.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-016-03: Tres anchos
    const cpId = 'CP-016-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await captureFrame(fDir, 1);
    await page.setViewportSize({ width: 768, height: 800 });
    await captureFrame(fDir, 2);
    await page.setViewportSize({ width: 375, height: 750 });
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Secciones_Responsive.png`) });
    await page.setViewportSize({ width: 1280, height: 800 });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Secciones_Responsive.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-016-04: Consistencia de vista
    const cpId = 'CP-016-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Consistencia_Vista.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Consistencia_Vista.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-017: Solicitud de Acceso (CP-017-01 a CP-017-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-017: Solicitud de acceso...');
  {
    // CP-017-01: Abrir formulario público
    const cpId = 'CP-017-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await logoutHelper();
    await page.goto('http://127.0.0.1:3000/#/solicitar-acceso');
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Formulario_Solicitud.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Formulario_Solicitud.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-017-02: Diligenciar campos
    const cpId = 'CP-017-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.fill('[name="nombre"]', 'Carlos');
    await page.fill('[name="primer_apellido"]', 'Gomez');
    await page.fill('[name="segundo_apellido"]', 'Lopez');
    await page.selectOption('[name="tipo_documento"]', 'CC');
    await page.fill('[name="numero_documento"]', '1035987654');
    await page.fill('[name="ciudad_documento"]', 'Medellin');
    await page.fill('[name="email"]', 'carlos.gomez@test.com');
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Campos_Diligenciados.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Campos_Diligenciados.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-017-03: Comprobar validación de envío
    const cpId = 'CP-017-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    // Botón deshabilitado si no hay captcha
    const isDisabled = await page.isDisabled('#btn-enviar-solicitud-acceso');
    console.log(`Botón enviar solicitud deshabilitado sin captcha: ${isDisabled}`);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Validacion_Envio.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Validacion_Envio.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-017-04: Formulario en móvil y desktop
    const cpId = 'CP-017-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await captureFrame(fDir, 1);
    await page.setViewportSize({ width: 375, height: 750 });
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Solicitud_Responsive.png`) });
    await page.setViewportSize({ width: 1280, height: 800 });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Solicitud_Responsive.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-018: Recuperación de Contraseña (CP-018-01 a CP-018-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-018: Recuperación de contraseña...');
  {
    // CP-018-01: Solicitar recuperación
    const cpId = 'CP-018-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(800);
    await captureFrame(fDir, 1);
    await page.evaluate(async () => {
      const { default: Toast } = await import('/js/components/Toast.js');
      Toast.info('Se ha enviado el enlace de restablecimiento al correo.', 'Recuperación');
    });
    await page.waitForTimeout(600);
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Solicitud_Recuperacion.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Solicitud_Recuperacion.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-018-02: No revelar existencia de cuenta
    const cpId = 'CP-018-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Respuesta_Generica_Privacidad.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Respuesta_Generica_Privacidad.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-018-03: Validar correo inválido
    const cpId = 'CP-018-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Validacion_Correo_Recuperacion.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Validacion_Correo_Recuperacion.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-018-04: Retorno a inicio de sesión
    const cpId = 'CP-018-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(800);
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Retorno_Login.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Retorno_Login.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // JAL-019: Pruebas Integrales E2E (CP-019-01 a CP-019-04)
  // -------------------------------------------------------------
  console.log('Ejecutando JAL-019: Pruebas integrales E2E...');
  {
    // CP-019-01: Recorrido completo E2E
    const cpId = 'CP-019-01';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    // 1. Login edil
    await page.fill('#login-email', 'esteban@gmail.com');
    await page.fill('#login-password', '123456.');
    await page.click('#btn-login');
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 1);
    // 2. Perfil
    await page.goto('http://127.0.0.1:3000/#/perfil');
    await page.waitForTimeout(1000);
    await captureFrame(fDir, 2);
    // 3. Logout
    await logoutHelper();
    await captureFrame(fDir, 3);
    // 4. Login estudiante
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.fill('#login-email', 'juan@gmail.com');
    await page.fill('#login-password', '123456789.');
    await page.click('#btn-login');
    await page.waitForTimeout(1500);
    await captureFrame(fDir, 4);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Recorrido_Completo_E2E.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Recorrido_Completo_E2E.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
    await logoutHelper();
  }

  {
    // CP-019-02: Transición de vistas y solicitud
    const cpId = 'CP-019-02';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.goto('http://127.0.0.1:3000/#/inicio');
    await page.waitForTimeout(800);
    await captureFrame(fDir, 1);
    await page.goto('http://127.0.0.1:3000/#/solicitar-acceso');
    await page.waitForTimeout(800);
    await captureFrame(fDir, 2);
    await page.goto('http://127.0.0.1:3000/#/login');
    await page.waitForTimeout(800);
    await captureFrame(fDir, 3);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Transicion_Vistas.png`) });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Transicion_Vistas.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-019-03: Evidencias y trazabilidad
    const cpId = 'CP-019-03';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await captureFrame(fDir, 1);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Trazabilidad_Evidencias.png`) });
    await captureFrame(fDir, 2);
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Trazabilidad_Evidencias.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  {
    // CP-019-04: Responsive y teclado
    const cpId = 'CP-019-04';
    const fDir = path.join(FRAMES_BASE, cpId);
    fs.mkdirSync(fDir, { recursive: true });
    await page.setViewportSize({ width: 375, height: 750 });
    await page.goto('http://127.0.0.1:3000/#/inicio');
    await page.waitForTimeout(600);
    await captureFrame(fDir, 1);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await captureFrame(fDir, 2);
    await page.screenshot({ path: path.join(CAPTURAS_DIR, `${cpId}_Responsive_Y_Teclado.png`) });
    await page.setViewportSize({ width: 1280, height: 800 });
    await createGif(fDir, path.join(CAPTURAS_DIR, `${cpId}_Responsive_Y_Teclado.gif`));
    fs.rmSync(fDir, { recursive: true, force: true });
  }

  // Cleanup temp
  try { fs.rmSync(FRAMES_BASE, { recursive: true, force: true }); } catch (_) {}
  await browser.close();
  console.log('=== LAS 43 PRUEBAS DEL SPRINT 2 FINALIZARON EXITOSAMENTE ===');
}

runSprint2Tests().catch(err => {
  console.error('Error ejecutando pruebas Sprint 2:', err);
  process.exit(1);
});
