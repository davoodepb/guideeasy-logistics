@echo off
chcp 65001 >nul
echo.
echo ====================================================
echo   PRUDENCIO LOGISTICS - Atualizar e Iniciar
echo ====================================================
echo.

echo [1/4] A instalar dependencias...
call npm install
echo.

echo [2/4] A guardar alteracoes no Git...
call git add -A
call git commit -m "fix: QR Code alta resolucao, PWA install real, QR Code Detetado no Excel e WhatsApp, manifest corrigido"
echo.

echo [3/4] A enviar para o GitHub...
call git remote remove origin 2>nul
call git remote add origin https://github.com/davoodepb/guideeasy-logistics.git
call git branch -M main 2>nul
call git push -u origin main --force
if errorlevel 1 (
    echo A tentar push com master...
    call git push -u origin master --force
)
echo.

echo [4/4] A arrancar o servidor na porta 8433...
echo.
echo ====================================================
echo   Abrir no browser: http://localhost:8433
echo   Password: Rpavg5n
echo ====================================================
echo.
call npm run dev
