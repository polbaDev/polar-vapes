@echo off
chcp 65001 >nul
title Boira - arrancando
cd /d "%~dp0"

if not exist ".env" (
  echo  Creando el archivo .env con una clave nueva...
  powershell -NoProfile -Command "$a='abcdefghijkmnpqrstuvwxyz23456789'; $r=[Security.Cryptography.RandomNumberGenerator]::Create(); $b=New-Object byte[] 16; $r.GetBytes($b); $p=-join ($b | ForEach-Object { $a[$_ -band 31] }); $p=$p.Substring(0,4)+'-'+$p.Substring(4,4)+'-'+$p.Substring(8,4)+'-'+$p.Substring(12,4); $k=New-Object byte[] 32; $r.GetBytes($k); $s=($k | ForEach-Object { $_.ToString('x2') }) -join ''; Set-Content -Encoding ascii -Path .env -Value @(('APP_PASSWORD=' + $p), ('AUTH_SECRET=' + $s), 'DATABASE_URL=postgres://vapers:vapers@localhost:5433/vapers', 'APP_TZ=Europe/Madrid'); Write-Host ''; Write-Host ('  Tu clave para entrar en la app: ' + $p) -ForegroundColor Yellow; Write-Host '  Esta guardada en el archivo .env. Apuntala.'; Write-Host ''"
)

findstr /x /c:"APP_PASSWORD=cambiame" .env >nul 2>nul
if not errorlevel 1 (
  echo.
  echo  AVISO: la clave de la app sigue siendo "cambiame". Cambiala en el archivo .env
  echo.
)

where docker >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No encuentro Docker. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/
  echo.
  pause
  exit /b 1
)

echo  Esperando a que Docker este listo...
set /a intentos=0
:esperar_docker
docker info >nul 2>nul
if not errorlevel 1 goto docker_listo
set /a intentos+=1
if %intentos% geq 90 (
  echo  Docker no responde. Abre Docker Desktop y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto esperar_docker

:docker_listo
echo  Construyendo y arrancando la app (la primera vez tarda unos minutos)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "docker compose up -d --build 2>&1 | Tee-Object -FilePath arranque.log; exit $LASTEXITCODE"
if errorlevel 1 (
  echo.
  echo  Algo ha fallado. Revisa el archivo arranque.log
  pause
  exit /b 1
)

echo  Esperando a que la web responda...
powershell -NoProfile -Command "for($i=0;$i -lt 120;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:3000/login -TimeoutSec 3 | Out-Null; exit 0}catch{Start-Sleep 2}}; exit 1"
docker compose logs app > app.log 2>&1
start "" http://localhost:3000
echo.
echo  Listo: http://localhost:3000
echo  Para pararla: parar.bat
echo.
timeout /t 15
