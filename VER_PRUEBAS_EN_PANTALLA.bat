@echo off
title Demostracion de Pruebas de QA en Pantalla - JAL Comuna 3
echo =====================================================================
echo   INICIANDO DEMOSTRACION VISUAL DE CASOS DE PRUEBA EN PANTALLA
echo   Proyecto: Voz Local - JAL Comuna 3 Manrique
echo =====================================================================
echo.
cd /d "%~dp0"
echo [1/2] Verificando servidor local en http://127.0.0.1:3000...
echo [2/2] Abriendo navegador interactivo visible con HUD en pantalla...
node "%~dp0scripts\observar_pruebas_en_vivo.cjs"
echo.
echo =====================================================================
echo   Demostracion finalizada con exito.
echo =====================================================================
ping -n 4 127.0.0.1 > nul
