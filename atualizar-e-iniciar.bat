@echo off
echo ===================================================
echo   A PREPARAR O PROJETO PRUDENCIO LOGISTICS
echo ===================================================
echo.

echo [1/4] A instalar novas dependencias (jsQR)...
call npm install

echo.
echo [2/4] A guardar as alteracoes no Git...
call git add -A
call git commit -m "feat: upgrade completo - OCR avancado, QR Code, Excel profissional, password auth, UI premium"

echo.
echo [3/4] A enviar para o GitHub...
call git remote remove origin 2>nul
call git remote add origin https://github.com/davoodepb/guideeasy-logistics.git
call git push -u origin main
if errorlevel 1 (
    echo [Aviso] Falhou o push para main, a tentar master...
    call git push -u origin master
)

echo.
echo [4/4] A arrancar o servidor...
echo O site vai abrir em: http://localhost:8433
echo Password de acesso: Rpavg5n
echo.
call npm run dev
