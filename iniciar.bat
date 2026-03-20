@echo off
title SnapStore
color 0A
echo.
echo  ================================================
echo    SnapStore - Descargador de imagenes
echo  ================================================
echo.

:: Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"

:: Instalar dependencias si no existen
if not exist "node_modules" (
    echo  Instalando dependencias por primera vez...
    echo  Esto puede tardar unos minutos.
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Fallo al instalar dependencias.
        pause
        exit /b 1
    )
)

echo  Iniciando servidor...
echo  Abriendo navegador en http://localhost:3000
echo.
echo  Para cerrar la app cierra esta ventana.
echo.

:: Abrir navegador tras 2 segundos
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Iniciar servidor
node server.js
pause
