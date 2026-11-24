@echo off
chcp 65001 >nul
setlocal
rem La ruta de la copia se lee antes de cambiar de carpeta (puede ser relativa)
set "COPIA=%~f1"
cd /d "%~dp0"

rem Restaura una copia hecha con copia.bat. SUSTITUYE todos los datos actuales por los de la copia.
rem   restaurar.bat "copias\vapers-2026-11-23_213000.dump"
rem   (o arrastra el archivo de la copia encima de restaurar.bat)
rem Antes guarda los datos actuales (si los hay) en copias\antes-de-restaurar. Luego para la app, borra la base
rem de datos y la crea vacia, carga la copia y vuelve a arrancar la app. Al arrancar, la app aplica
rem las migraciones que falten: una copia de una version anterior queda al dia.

rem Base de datos que se sustituye (cambiala solo para hacer pruebas)
set "BD=vapers"
set "LOG=%~dp0copias\copias.log"
rem Nombre unico dentro del contenedor
set "TEMPORAL=/tmp/restaurar-%RANDOM%%RANDOM%.dump"
set "MOTIVO="
if not exist "%~dp0copias\" mkdir "%~dp0copias" 2>nul

if "%~1"=="" goto uso
if not exist "%COPIA%" goto uso
if exist "%COPIA%\" goto uso
rem Sin .env docker compose no funciona (en un PC nuevo, arrancar.bat lo crea)
if not exist ".env" (
  echo.
  echo  Falta el archivo .env. En un PC nuevo, ejecuta antes arrancar.bat y luego restaura la copia.
  echo.
  pause
  exit /b 1
)

echo.
echo  ATENCION: esto SUSTITUYE todos los datos actuales de la app (ventas, compras, stock,
echo  catalogo y fotos) por los de esta copia:
echo.
echo    %COPIA%
echo.
echo  Antes se guarda una copia de los datos actuales en copias\antes-de-restaurar.
echo.
set "RESPUESTA="
set /p "RESPUESTA=  Para seguir escribe SI y pulsa Intro: "
if /i not "%RESPUESTA%"=="SI" (
  echo  Cancelado. No se ha tocado nada.
  pause
  exit /b 1
)

>>"%LOG%" echo %date% %time% Restaurando %COPIA%

set "MOTIVO=Docker no responde. Abre Docker Desktop y vuelve a intentarlo"
docker info >nul 2>nul
if errorlevel 1 goto sin_tocar

echo  Preparando la base de datos...
set "MOTIVO=no se pudo arrancar la base de datos"
docker compose up -d db
if errorlevel 1 goto sin_tocar
set "MOTIVO=la base de datos no responde"
set /a intentos=0
:esperar_bd
docker compose exec -T db pg_isready -U vapers -q >nul 2>nul
if not errorlevel 1 goto bd_lista
set /a intentos+=1
if %intentos% geq 60 goto sin_tocar
timeout /t 2 /nobreak >nul
goto esperar_bd

:bd_lista
echo  Comprobando la copia...
set "MOTIVO=no se pudo pasar la copia al contenedor"
docker compose cp "%COPIA%" "db:%TEMPORAL%" >nul
if errorlevel 1 goto sin_tocar
set "MOTIVO=el archivo no es una copia valida"
docker compose exec -T db pg_restore --list "%TEMPORAL%" >nul
if errorlevel 1 goto sin_tocar

rem Si la base de datos no existe o no tiene tablas (por ejemplo, tras una restauracion fallida),
rem no hay nada que guardar: asi la copia buena de antes-de-restaurar no queda detras de una vacia
set "ANTES="
set "MOTIVO=no se pudo consultar la base de datos"
set "HAY="
for /f %%i in ('docker compose exec -T db psql -U vapers -d postgres -tAc "select count(*) from pg_database where datname = '%BD%'"') do set "HAY=%%i"
if not defined HAY goto sin_tocar
if "%HAY%"=="0" goto sin_datos
set "HAY="
for /f %%i in ('docker compose exec -T db psql -U vapers -d %BD% -tAc "select count(*) from pg_tables where schemaname = 'public'"') do set "HAY=%%i"
if not defined HAY goto sin_tocar
if "%HAY%"=="0" goto sin_datos

echo  Guardando los datos actuales en copias\antes-de-restaurar...
set "MOTIVO=no se pudo guardar la copia de los datos actuales"
set "COPIA_HECHA="
call "%~dp0copia.bat" "%~dp0copias\antes-de-restaurar"
if errorlevel 1 goto sin_tocar
if not defined COPIA_HECHA goto sin_tocar
set "ANTES=%COPIA_HECHA%"
>>"%LOG%" echo %date% %time% Datos de antes guardados en %ANTES%
goto parar_app

:sin_datos
echo  La base de datos actual esta vacia: no hay datos que guardar.
>>"%LOG%" echo %date% %time% La base de datos estaba vacia: no se guarda copia de antes

:parar_app
rem Se para la app si existe su contenedor (aunque este reiniciandose)
set "EXISTE="
for /f %%i in ('docker compose ps -a -q app 2^>nul') do set "EXISTE=1"
if not defined EXISTE goto app_parada
echo  Parando la app...
set "MOTIVO=no se pudo parar la app"
docker compose stop app
if errorlevel 1 goto sin_tocar
:app_parada

rem A partir de aqui se borran los datos actuales.
rem Se borra la base de datos entera: si la copia es de una version anterior, no quedan tablas
rem ni migraciones de la version nueva mezcladas con las de la copia.
echo  Restaurando la copia...
set "MOTIVO=no se pudo borrar y crear de nuevo la base de datos"
docker compose exec -T db psql -U vapers -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS %BD% WITH (FORCE);" -c "CREATE DATABASE %BD% OWNER vapers;"
if errorlevel 1 goto error
set "MOTIVO=pg_restore ha fallado"
docker compose exec -T db pg_restore -U vapers -d %BD% --no-owner --exit-on-error --single-transaction "%TEMPORAL%"
if errorlevel 1 goto error
docker compose exec -T db rm -f "%TEMPORAL%" >nul 2>nul
>>"%LOG%" echo %date% %time% RESTAURADA %COPIA%

echo  Arrancando la app (aplica las migraciones que falten)...
docker compose up -d app
if errorlevel 1 goto no_arranca
echo  Esperando a que la web responda...
powershell -NoProfile -Command "for($i=0;$i -lt 120;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:3000/login -TimeoutSec 3 | Out-Null; exit 0}catch{Start-Sleep 2}}; exit 1"
if errorlevel 1 goto no_arranca
echo.
echo  Listo: copia restaurada y app en marcha en http://localhost:3000
if defined ANTES echo  Los datos de antes estan en: %ANTES%
echo.
pause
exit /b 0

:no_arranca
docker compose logs app > app.log 2>&1
>>"%LOG%" echo %date% %time% AVISO: copia restaurada, pero la app no ha arrancado
echo.
echo  La copia se ha restaurado, pero la app no ha arrancado. Revisa app.log
call :como_volver
echo.
pause
exit /b 1

:sin_tocar
docker compose exec -T db rm -f "%TEMPORAL%" >nul 2>nul
>>"%LOG%" echo %date% %time% ERROR: no se pudo restaurar: %MOTIVO%. No se ha tocado nada
echo.
echo  ERROR: %MOTIVO%.
echo  No se ha tocado nada.
echo.
pause
exit /b 1

:error
docker compose exec -T db rm -f "%TEMPORAL%" >nul 2>nul
>>"%LOG%" echo %date% %time% ERROR: no se pudo restaurar: %MOTIVO%
echo.
echo  ERROR: %MOTIVO%. La app se queda parada.
call :como_volver
echo.
pause
exit /b 1

rem Dice con que copia se vuelve a como estaba antes de restaurar (sin bloques: la ruta puede llevar parentesis)
:como_volver
if not defined ANTES echo  La base de datos ya estaba vacia al empezar: no se ha guardado copia de antes.
if not defined ANTES exit /b
echo  Los datos de antes estan en: %ANTES%
echo  Para dejarlo como estaba, restaura esa copia con restaurar.bat
exit /b

:uso
echo.
echo  Uso: restaurar.bat "copias\vapers-AAAA-MM-DD_HHMMSS.dump"
echo  O arrastra el archivo de la copia encima de restaurar.bat
if not "%~1"=="" echo  No encuentro el archivo: %COPIA%
echo.
pause
exit /b 1
