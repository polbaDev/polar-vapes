@echo off
chcp 65001 >nul
title PolAr Vapes - arrancando
cd /d "%~dp0"

if not exist ".env" (
  echo  Creando el archivo .env con una clave nueva...
  powershell -NoProfile -Command "$a='abcdefghijkmnpqrstuvwxyz23456789'; $r=[Security.Cryptography.RandomNumberGenerator]::Create(); $b=New-Object byte[] 16; $r.GetBytes($b); $p=-join ($b | ForEach-Object { $a[$_ -band 31] }); $p=$p.Substring(0,4)+'-'+$p.Substring(4,4)+'-'+$p.Substring(8,4)+'-'+$p.Substring(12,4); $k=New-Object byte[] 32; $r.GetBytes($k); $s=($k | ForEach-Object { $_.ToString('x2') }) -join ''; Set-Content -Encoding ascii -Path .env -Value @(('APP_PASSWORD=' + $p), ('AUTH_SECRET=' + $s), 'DATABASE_URL=postgres://vapers:vapers@localhost:5433/vapers', 'APP_TZ=Europe/Madrid'); Write-Host ''; Write-Host ('  Clave de la app: ' + $p) -ForegroundColor Yellow; Write-Host '  Sirve para crear la primera cuenta al entrar por primera vez. Esta guardada en el archivo .env.'; Write-Host ''"
)

rem Si la clave o AUTH_SECRET estan vacios, son los de ejemplo o son cortos (la app pide 8 y 32
rem caracteres), los cambia por unos nuevos (igual que al crear el .env) y deja el resto de lineas
powershell -NoProfile -Command "$f=Join-Path $PWD.Path '.env'; $a='abcdefghijkmnpqrstuvwxyz23456789'; $r=[Security.Cryptography.RandomNumberGenerator]::Create(); $b=New-Object byte[] 16; $r.GetBytes($b); $p=-join ($b | ForEach-Object { $a[$_ -band 31] }); $p=$p.Substring(0,4)+'-'+$p.Substring(4,4)+'-'+$p.Substring(8,4)+'-'+$p.Substring(12,4); $k=New-Object byte[] 32; $r.GetBytes($k); $s=($k | ForEach-Object { $_.ToString('x2') }) -join ''; $n=@(); $hp=$false; $hs=$false; $cp=$false; $cs=$false; foreach ($x in [IO.File]::ReadAllLines($f)) { if ($x -cmatch '^\s*APP_PASSWORD\s*=(.*)$') { $hp=$true; $v=$matches[1].Trim().Trim([char]34,[char]39); if ($v.Length -lt 8 -or $v -eq 'cambiame' -or $v -like 'cambia-esta-contrase*') { $cp=$true; $x='APP_PASSWORD='+$p } } elseif ($x -cmatch '^\s*AUTH_SECRET\s*=(.*)$') { $hs=$true; $v=$matches[1].Trim().Trim([char]34,[char]39); if ($v.Length -lt 32 -or $v -eq 'cambia-esto-por-una-cadena-larga-y-aleatoria') { $cs=$true; $x='AUTH_SECRET='+$s } }; $n+=$x }; if (-not $hp) { $cp=$true; $n+='APP_PASSWORD='+$p }; if (-not $hs) { $cs=$true; $n+='AUTH_SECRET='+$s }; if ($cp -or $cs) { [IO.File]::WriteAllLines($f, [string[]]$n, (New-Object Text.UTF8Encoding $false)) }; if ($cs) { Write-Host '  AUTH_SECRET era el de ejemplo o muy corto: he puesto uno nuevo en el archivo .env (hay que volver a entrar en la app).' }; if ($cp) { Write-Host '  La clave de la app era la de ejemplo, estaba vacia o era muy corta: he puesto una nueva.'; Write-Host ''; Write-Host ('  Clave de la app: ' + $p) -ForegroundColor Yellow; Write-Host '  Sirve para crear la primera cuenta al entrar por primera vez. Esta guardada en el archivo .env.'; Write-Host '' }"

rem La primera vez, programa la copia de seguridad diaria (21:30)
schtasks /query /tn "Gestion Vapers - copia diaria" >nul 2>nul
if errorlevel 1 call "%~dp0programar-copia.bat" auto

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
set "WEB=si"
powershell -NoProfile -Command "for($i=0;$i -lt 120;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:3000/login -TimeoutSec 3 | Out-Null; exit 0}catch{Start-Sleep 2}}; exit 1"
if errorlevel 1 set "WEB=no"
docker compose logs app > app.log 2>&1
if "%WEB%"=="no" (
  echo.
  echo  La app no ha arrancado. Revisa app.log
  echo.
  pause
  exit /b 1
)
start "" http://localhost:3000
echo.
echo  Listo: http://localhost:3000
echo  Para pararla: parar.bat
echo.
timeout /t 15
