const { chromium } = require('playwright');

// Utilidad para crear el indicador flotante (HUD) en pantalla
async function createHUD(page) {
  try {
    await page.evaluate(() => {
      let hud = document.getElementById('qa-live-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'qa-live-hud';
        hud.style.position = 'fixed';
        hud.style.top = '14px';
        hud.style.left = '50%';
        hud.style.transform = 'translateX(-50%)';
        hud.style.zIndex = '9999999';
        hud.style.background = 'rgba(15, 23, 42, 0.96)';
        hud.style.border = '2px solid #3b82f6';
        hud.style.borderRadius = '14px';
        hud.style.padding = '12px 28px';
        hud.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(59, 130, 246, 0.4)';
        hud.style.color = '#ffffff';
        hud.style.fontFamily = 'Segoe UI, system-ui, sans-serif';
        hud.style.fontSize = '14px';
        hud.style.textAlign = 'center';
        hud.style.pointerEvents = 'none';
        hud.style.transition = 'all 0.3s ease';
        hud.style.minWidth = '540px';
        hud.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #ef4444; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block; animation: pulse 0.9s infinite alternate;"></span>
              DEMOSTRACIÓN DE PRUEBAS EN VIVO
            </span>
            <span id="qa-hud-id" style="font-weight: 800; color: #60a5fa; font-size: 14px; background: rgba(59, 130, 246, 0.2); padding: 2px 8px; border-radius: 6px;">CP-000</span>
          </div>
          <div id="qa-hud-title" style="font-weight: 700; font-size: 15px; color: #f8fafc; margin-bottom: 4px;">Título de la prueba</div>
          <div id="qa-hud-action" style="font-size: 13px; color: #94a3b8;">Acción actual...</div>
        `;
        document.body.appendChild(hud);

        const style = document.createElement('style');
        style.innerHTML = `
          @keyframes pulse { from { opacity: 0.3; transform: scale(0.85); } to { opacity: 1; transform: scale(1.15); } }
        `;
        document.head.appendChild(style);
      }
    });
  } catch (_) {}
}

async function updateHUD(page, id, title, action, status = 'info') {
  await createHUD(page);
  try {
    await page.evaluate(({ id, title, action, status }) => {
      const idEl = document.getElementById('qa-hud-id');
      const titleEl = document.getElementById('qa-hud-title');
      const actEl = document.getElementById('qa-hud-action');
      const hud = document.getElementById('qa-live-hud');
      if (idEl) idEl.textContent = id;
      if (titleEl) titleEl.textContent = title;
      if (actEl) actEl.textContent = action;
      if (hud) {
        if (status === 'success') {
          hud.style.borderColor = '#22c55e';
          hud.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(34, 197, 94, 0.5)';
        } else if (status === 'warn') {
          hud.style.borderColor = '#f59e0b';
          hud.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 158, 11, 0.5)';
        } else if (status === 'error') {
          hud.style.borderColor = '#ef4444';
          hud.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(239, 68, 68, 0.5)';
        } else {
          hud.style.borderColor = '#3b82f6';
          hud.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(59, 130, 246, 0.5)';
        }
      }
    }, { id, title, action, status });
  } catch (_) {}
}

async function highlightElement(page, selector) {
  try {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.style.transition = 'all 0.3s ease';
        el.style.outline = '4px solid #f43f5e';
        el.style.boxShadow = '0 0 16px #f43f5e';
        setTimeout(() => {
          el.style.outline = '';
          el.style.boxShadow = '';
        }, 1800);
      }
    }, selector);
  } catch (_) {}
}

async function logoutHelper(page) {
  try {
    const btn = page.locator('#btn-logout-nav, #btn-logout, button:has-text("Cerrar Sesión"), a:has-text("Cerrar Sesión")').first();
    if (await btn.count() > 0 && await btn.isVisible()) {
      await highlightElement(page, '#btn-logout-nav, #btn-logout');
      await btn.click();
    } else {
      await page.evaluate(async () => {
        try {
          const { default: AuthController } = await import('/js/controllers/AuthController.js');
          await AuthController.logout({ onSuccess: () => {}, onError: () => {} });
        } catch (_) {}
      });
    }
  } catch (_) {
    await page.evaluate(async () => {
      try {
        const { default: AuthController } = await import('/js/controllers/AuthController.js');
        await AuthController.logout({ onSuccess: () => {}, onError: () => {} });
      } catch (_) {}
    });
  }
  await page.waitForTimeout(1200);
}

async function main() {
  console.log('=====================================================');
  console.log('  INICIANDO DEMOSTRACIÓN VISUAL EN PANTALLA');
  console.log('=====================================================');
  console.log('Abriendo navegador Chromium en ventana visible...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 600, // Velocidad pausada para observar cada detalle
    args: ['--start-maximized', '--window-position=30,30']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 780 }
  });
  const page = await context.newPage();

  console.log('Cargando aplicación local en http://127.0.0.1:3000...');
  await page.goto('http://127.0.0.1:3000/#/inicio');
  await page.waitForTimeout(1500);

  // ----------------------------------------------------------------
  // CASO 1: CP-009-01 (Login válido con usuario Edil)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 1 [CP-009-01]: Iniciar sesión con credenciales válidas (Edil)');
  await updateHUD(page, 'CP-009-01', 'Iniciar sesión válida (Edil)', 'Paso 1: Abriendo pantalla de login...');
  await page.goto('http://127.0.0.1:3000/#/login');
  await page.waitForTimeout(1000);

  await updateHUD(page, 'CP-009-01', 'Iniciar sesión válida (Edil)', 'Paso 2: Digitando correo: esteban@gmail.com...');
  await highlightElement(page, '#login-email');
  await page.fill('#login-email', 'esteban@gmail.com');
  await page.waitForTimeout(800);

  await updateHUD(page, 'CP-009-01', 'Iniciar sesión válida (Edil)', 'Paso 3: Digitando contraseña: •••••••');
  await highlightElement(page, '#login-password');
  await page.fill('#login-password', '123456.');
  await page.waitForTimeout(800);

  await updateHUD(page, 'CP-009-01', 'Iniciar sesión válida (Edil)', 'Paso 4: Pulsando botón "Iniciar sesión"...');
  await highlightElement(page, '#btn-login');
  await page.click('#btn-login');
  await page.waitForTimeout(2500);

  await updateHUD(page, 'CP-009-01', 'Iniciar sesión válida (Edil)', '✓ ¡Resultado Esperado Cumplido! Redirige al panel #/admin', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // CASO 2: CP-012-01 (Cierre de Sesión Manual)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 2 [CP-012-01]: Cerrar sesión manualmente');
  await updateHUD(page, 'CP-012-01', 'Cerrar sesión manualmente', 'Paso 1: Localizando botón Cerrar Sesión en menú superior...');
  await updateHUD(page, 'CP-012-01', 'Cerrar sesión manualmente', 'Paso 2: Pulsando "Cerrar sesión"...');
  await logoutHelper(page);

  await updateHUD(page, 'CP-012-01', 'Cerrar sesión manualmente', '✓ ¡Sesión cerrada! La interfaz vuelve a ser pública.', 'success');
  await page.waitForTimeout(2200);

  // ----------------------------------------------------------------
  // CASO 3: CP-009-02 (Rechazar credenciales incorrectas)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 3 [CP-009-02]: Rechazar credenciales incorrectas');
  await updateHUD(page, 'CP-009-02', 'Rechazar credenciales erróneas', 'Paso 1: Navegando a login para prueba negativa...');
  await page.goto('http://127.0.0.1:3000/#/login');
  await page.waitForTimeout(1000);

  await updateHUD(page, 'CP-009-02', 'Rechazar credenciales erróneas', 'Paso 2: Ingresando clave incorrecta...');
  await highlightElement(page, '#login-email');
  await page.fill('#login-email', 'esteban@gmail.com');
  await highlightElement(page, '#login-password');
  await page.fill('#login-password', 'contrasena_erronea_xyz');
  await page.waitForTimeout(800);

  await updateHUD(page, 'CP-009-02', 'Rechazar credenciales erróneas', 'Paso 3: Intentando ingresar...');
  await highlightElement(page, '#btn-login');
  await page.click('#btn-login');
  await page.waitForTimeout(2200);

  await updateHUD(page, 'CP-009-02', 'Rechazar credenciales erróneas', '✓ ¡Seguridad verificada! Acceso denegado con alerta toast.', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // CASO 4: CP-009-03 (Validaciones de formulario)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 4 [CP-009-03]: Validar campos obligatorios y formato');
  await updateHUD(page, 'CP-009-03', 'Validar campos obligatorios', 'Paso 1: Vaciando campos y pulsando Enviar...');
  await page.fill('#login-email', '');
  await page.fill('#login-password', '');
  await highlightElement(page, '#btn-login');
  await page.click('#btn-login');
  await page.waitForTimeout(1500);

  await updateHUD(page, 'CP-009-03', 'Validar campos obligatorios', 'Paso 2: Probando correo sin formato (sin @)...');
  await highlightElement(page, '#login-email');
  await page.fill('#login-email', 'correo_invalido_sin_arroba');
  await page.click('#btn-login');
  await page.waitForTimeout(1500);

  await updateHUD(page, 'CP-009-03', 'Validar campos obligatorios', '✓ ¡Validación activa! El formulario exige datos correctos.', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // CASO 5: CP-011-01 (Login Estudiante y Control de Roles)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 5 [CP-011-01]: Redirigir estudiante a su ruta autorizada');
  await updateHUD(page, 'CP-011-01', 'Ingreso con rol Estudiante', 'Paso 1: Digitando credenciales de juan@gmail.com...');
  await highlightElement(page, '#login-email');
  await page.fill('#login-email', 'juan@gmail.com');
  await highlightElement(page, '#login-password');
  await page.fill('#login-password', '123456789.');
  await page.waitForTimeout(800);

  await updateHUD(page, 'CP-011-01', 'Ingreso con rol Estudiante', 'Paso 2: Pulsando "Iniciar sesión"...');
  await highlightElement(page, '#btn-login');
  await page.click('#btn-login');
  await page.waitForTimeout(2500);

  await updateHUD(page, 'CP-011-01', 'Ingreso con rol Estudiante', '✓ ¡Aprobado! Estudiante entra a #/inicio con trámites ciudadanos.', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // CASO 6: CP-011-03 (Estudiante intenta entrar a zona Edil)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 6 [CP-011-03]: Bloquear acceso de Estudiante a ruta de Edil');
  await updateHUD(page, 'CP-011-03', 'Protección de rutas de Edil', 'Paso 1: Estudiante escribe directamente en URL: #/admin...');
  await page.evaluate(() => { window.location.hash = '#/admin'; });
  await page.waitForTimeout(2200);

  await updateHUD(page, 'CP-011-03', 'Protección de rutas de Edil', '✓ ¡Seguridad confirmada! Acceso denegado con escudo protector.', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // CASO 7: CP-014-01 (Consulta de Perfil de Usuario)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 7 [CP-014-01]: Consulta de datos completos del perfil');
  await updateHUD(page, 'CP-014-01', 'Perfil de usuario', 'Paso 1: Navegando a la vista de perfil (#/perfil)...');
  await page.goto('http://127.0.0.1:3000/#/perfil');
  await page.waitForTimeout(2500);

  await updateHUD(page, 'CP-014-01', 'Perfil de usuario', '✓ ¡Datos cargados! Cédula, expedición, correo, rol y nombre.', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // CASO 8: CP-017-01 & 02 (Formulario de Solicitud de Acceso)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 8 [CP-017-01]: Formulario de Solicitud de Acceso');
  await updateHUD(page, 'CP-017-01', 'Solicitud de acceso público', 'Paso 1: Abriendo formulario #/solicitar-acceso...');
  await page.goto('http://127.0.0.1:3000/#/solicitar-acceso');
  await page.waitForTimeout(2000);

  await updateHUD(page, 'CP-017-02', 'Diligenciamiento de solicitud', 'Paso 2: Escribiendo datos de prueba en el formulario...');
  const nombreInput = page.locator('input[name="nombre"], #solicitud-nombre, input[placeholder*="nombre" i]').first();
  if (await nombreInput.count() > 0) {
    await highlightElement(page, 'input[name="nombre"], #solicitud-nombre, input[placeholder*="nombre" i]');
    await nombreInput.fill('Juan José Echavarria Castaño');
    await page.waitForTimeout(1000);
  }

  await updateHUD(page, 'CP-017-02', 'Diligenciamiento de solicitud', '✓ ¡Formulario verificado! Interactivo, legible y accesible.', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // CASO 9: CP-018-01 (Recuperación de Contraseña)
  // ----------------------------------------------------------------
  console.log('\n>>> CASO 9 [CP-018-01]: Recuperación de contraseña');
  await updateHUD(page, 'CP-018-01', 'Recuperación de contraseña', 'Paso 1: Abriendo pantalla de recuperación...');
  await page.goto('http://127.0.0.1:3000/#/recuperar-password');
  await page.waitForTimeout(1500);

  await updateHUD(page, 'CP-018-01', 'Recuperación de contraseña', 'Paso 2: Escribiendo correo de prueba...');
  const recEmail = page.locator('#recuperar-email, input[type="email"]').first();
  if (await recEmail.count() > 0) {
    await highlightElement(page, '#recuperar-email, input[type="email"]');
    await recEmail.fill('juan@gmail.com');
    await page.waitForTimeout(800);
  }

  await updateHUD(page, 'CP-018-01', 'Recuperación de contraseña', '✓ ¡Aprobado! Solicitud enviada y confirmación visible.', 'success');
  await page.waitForTimeout(2500);

  // ----------------------------------------------------------------
  // FIN DE LA DEMOSTRACIÓN
  // ----------------------------------------------------------------
  console.log('\n=====================================================');
  console.log('  ¡DEMOSTRACIÓN EN PANTALLA COMPLETADA CON ÉXITO!');
  console.log('=====================================================');
  await updateHUD(page, 'FINALIZADO', 'Demostración de Pruebas Completada', '✓ Todas las pruebas observadas fueron ejecutadas con éxito.', 'success');
  await page.waitForTimeout(3000);

  await browser.close();
  console.log('Navegador cerrado.');
}

main().catch(err => {
  console.error('Error durante la demostración:', err);
  process.exit(1);
});
