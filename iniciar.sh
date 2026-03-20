#!/bin/bash

echo ""
echo " ================================================"
echo "   SnapStore - Descargador de imagenes"
echo " ================================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo " [ERROR] Node.js no está instalado."
    echo " Descárgalo en: https://nodejs.org"
    echo ""
    exit 1
fi

cd "$(dirname "$0")"

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo " Instalando dependencias por primera vez..."
    echo " Esto puede tardar unos minutos."
    echo ""
    npm install
fi

echo " Iniciando servidor..."
echo " Abriendo navegador en http://localhost:3000"
echo ""
echo " Para cerrar la app pulsa Ctrl+C"
echo ""

# Abrir navegador según el sistema
(sleep 2 && (
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open &> /dev/null; then
        open http://localhost:3000
    fi
)) &

node server.js
