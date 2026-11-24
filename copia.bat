@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

rem Copia de seguridad de la base de datos (ventas, compras, stock, catalogo y fotos).
rem   copia.bat                  guarda en la carpeta "copias" de aqui
rem   copia.bat "E:\Copias"      guarda en otra carpeta (USB, OneDrive, Google Drive...)
rem Se conservan las copias de los ultimos 30 dias; las mas antiguas se borran solas.
rem Si Docker aun esta arrancando, espera hasta 5 minutos. Si la app esta parada (parar.bat),
rem arranca solo la base de datos para hacer la copia y luego la vuelve a parar.
rem Para restaurar una copia: restaurar.bat (mira el apartado "Copia de seguridad" del README).

set "DESTINO=%~1"
if "%DESTINO%"=="" set "DESTINO=%~dp0copias"
rem Quita la barra del final ("E:\" queda "E:"): con ella forfiles falla
if "%DESTINO:~-1%"=="\" set "DESTINO=%DESTINO:~0,-1%"
if not exist "%DESTINO%\" mkdir "%DESTINO%" 2>nul
if not exist "%DESTINO%\" (
  echo  ERROR: no se puede crear la carpeta "%DESTINO%"
  exit /b 1
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set "FECHA=%%i"
set "ARCHIVO=%DESTINO%\vapers-%FECHA%.dump"
rem Nunca se sobrescribe una copia que ya exista
if exist "%ARCHIVO%" set "ARCHIVO=%DESTINO%\vapers-%FECHA%-%RANDOM%.dump"
set "LOG=%DESTINO%\copias.log"
rem Nombre unico dentro del contenedor: dos copias a la vez no se pisan
set "TEMPORAL=/tmp/copia-%FECHA%-%RANDOM%%RANDOM%.dump"
set "MOTIVO="
set "ARRANCADA="
set "OK="

where docker >nul 2>nul
if errorlevel 1 (
  set "MOTIVO=no encuentro Docker"
  goto fallo
)

rem Si la tarea se lanza nada mas encender el PC, Docker tarda en responder
set /a intentos=0
:esperar_docker
docker info >nul 2>nul
if not errorlevel 1 goto docker_listo
set /a intentos+=1
if %intentos% equ 1 echo  Esperando a que Docker este listo...
if %intentos% geq 60 (
  set "MOTIVO=Docker no responde"
  goto fallo
)
timeout /t 5 /nobreak >nul
goto esperar_docker

:docker_listo
docker compose config -q >nul 2>nul
if errorlevel 1 (
  set "MOTIVO=docker compose no funciona, falta el archivo .env o no es valido"
  goto fallo
)
set "EN_MARCHA="
for /f %%i in ('docker compose ps --status running -q db 2^>nul') do set "EN_MARCHA=1"
if defined EN_MARCHA goto esperar_bd
echo  La base de datos esta parada: la arranco para hacer la copia...
>>"%LOG%" echo %date% %time% La base de datos estaba parada: se arranca para hacer la copia
set "ARRANCADA=1"
docker compose up -d db
if errorlevel 1 (
  set "MOTIVO=no se pudo arrancar la base de datos"
  goto terminar
)

:esperar_bd
set /a intentos=0
:esperar_bd_bucle
docker compose exec -T db pg_isready -U vapers -d vapers -q >nul 2>nul
if not errorlevel 1 goto copiar
set /a intentos+=1
if %intentos% geq 60 (
  set "MOTIVO=la base de datos no responde"
  goto terminar
)
timeout /t 2 /nobreak >nul
goto esperar_bd_bucle

:copiar
docker compose exec -T db pg_dump -U vapers -d vapers -Fc -f "%TEMPORAL%"
if errorlevel 1 (
  set "MOTIVO=pg_dump ha fallado"
  goto terminar
)
rem Comprueba que la copia se puede leer antes de darla por buena
docker compose exec -T db pg_restore --list "%TEMPORAL%" >nul
if errorlevel 1 (
  set "MOTIVO=la copia no se puede leer con pg_restore"
  goto terminar
)
docker compose cp "db:%TEMPORAL%" "%ARCHIVO%" >nul
if errorlevel 1 (
  set "MOTIVO=no se pudo sacar la copia del contenedor"
  goto terminar
)
if not exist "%ARCHIVO%" (
  set "MOTIVO=no se encuentra el archivo de la copia"
  goto terminar
)
for %%A in ("%ARCHIVO%") do if %%~zA LSS 1000 set "MOTIVO=la copia ha salido vacia"
if not defined MOTIVO set "OK=1"

:terminar
docker compose exec -T db rm -f "%TEMPORAL%" >nul 2>nul
if not defined ARRANCADA goto resultado
rem Si existe el contenedor de la app (arrancando, en marcha o reiniciandose), necesita la base
rem de datos: no se para. Despues de parar.bat no existe.
set "EXISTE="
for /f %%i in ('docker compose ps -a -q app 2^>nul') do set "EXISTE=1"
if defined EXISTE (
  >>"%LOG%" echo %date% %time% La app se esta arrancando o esta en marcha: la base de datos se deja arrancada
  goto resultado
)
docker compose stop db >nul 2>nul
if errorlevel 1 (
  >>"%LOG%" echo %date% %time% AVISO: no se pudo volver a parar la base de datos
) else (
  >>"%LOG%" echo %date% %time% La base de datos se ha vuelto a parar
)

:resultado
if not defined OK goto fallo
pushd "%DESTINO%\" && (
  forfiles /m vapers-*.dump /d -30 /c "cmd /c del @path" >nul 2>nul
  popd
)

>>"%LOG%" echo %date% %time% OK %ARCHIVO%
echo  Copia guardada en: %ARCHIVO%
rem Deja el nombre de la copia en COPIA_HECHA para quien la llama (restaurar.bat)
endlocal & set "COPIA_HECHA=%ARCHIVO%" & exit /b 0

:fallo
>>"%LOG%" echo %date% %time% ERROR: no se pudo hacer la copia: %MOTIVO%
echo  ERROR: no se pudo hacer la copia: %MOTIVO%.
echo  Comprueba que Docker esta arrancado. Los detalles quedan en %LOG%
exit /b 1
