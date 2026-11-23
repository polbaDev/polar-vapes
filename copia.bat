@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

rem Copia de seguridad de la base de datos (ventas, compras, stock, catalogo y fotos).
rem   copia.bat                  guarda en la carpeta "copias" de aqui
rem   copia.bat "E:\Copias"      guarda en otra carpeta (USB, OneDrive, Google Drive...)
rem Se conservan las copias de los ultimos 30 dias; las mas antiguas se borran solas.
rem Para restaurar una copia, mira el apartado "Copia de seguridad" del README.

set "DESTINO=%~1"
if "%DESTINO%"=="" set "DESTINO=%~dp0copias"
if not exist "%DESTINO%\" mkdir "%DESTINO%" 2>nul
if not exist "%DESTINO%\" (
  echo  ERROR: no se puede crear la carpeta %DESTINO%
  exit /b 1
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "FECHA=%%i"
set "ARCHIVO=%DESTINO%\vapers-%FECHA%.dump"
set "LOG=%DESTINO%\copias.log"

docker compose exec -T db pg_dump -U vapers -d vapers -Fc -f /tmp/copia.dump
if errorlevel 1 goto fallo
docker compose cp db:/tmp/copia.dump "%ARCHIVO%" >nul
if errorlevel 1 goto fallo
docker compose exec -T db rm -f /tmp/copia.dump >nul 2>nul
for %%A in ("%ARCHIVO%") do if %%~zA LSS 1000 goto fallo

forfiles /p "%DESTINO%" /m vapers-*.dump /d -30 /c "cmd /c del @path" >nul 2>nul

>>"%LOG%" echo %date% %time% OK %ARCHIVO%
echo  Copia guardada en: %ARCHIVO%
exit /b 0

:fallo
>>"%LOG%" echo %date% %time% ERROR: no se pudo hacer la copia
echo  ERROR: no se pudo hacer la copia. Comprueba que Docker y la app estan arrancados.
exit /b 1
