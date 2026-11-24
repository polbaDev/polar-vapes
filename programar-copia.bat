@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

rem Crea (o rehace) la tarea del Programador de tareas de Windows que hace la copia diaria:
rem   todos los dias a las 21:30 ejecuta copia.bat de esta carpeta. Si el PC esta apagado
rem   a esa hora, la copia se hace la proxima vez que lo enciendas.
rem   Solo se ejecuta con la sesion iniciada (Docker Desktop la necesita).
rem arrancar.bat la crea sola la primera vez. Ejecutalo a mano si mueves la carpeta de la app.

set "TAREA=Gestion Vapers - copia diaria"
set "CARPETA=%~dp0"

rem La hora va sin zona horaria para que sean siempre las 21:30 de aqui (tambien en verano).
rem Empieza en las proximas 21:30: si ya han pasado, no lanza una copia nada mas crear la tarea.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $f=$env:CARPETA+'copia.bat'; $q=[char]34; $a=New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c '+$q+$q+$f+$q+$q) -WorkingDirectory (Split-Path $f); $t=New-ScheduledTaskTrigger -Daily -At '21:30'; $d=[datetime]::Today; if ((Get-Date) -gt $d.AddHours(21.5)) { $d=$d.AddDays(1) }; $t.StartBoundary=$d.ToString('yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)+'T21:30:00'; $s=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1); $p=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName $env:TAREA -Action $a -Trigger $t -Settings $s -Principal $p -Description 'Copia de seguridad diaria de la base de datos (copia.bat)' -Force -ErrorAction Stop | Out-Null; exit 0 } catch { Write-Host ('  ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo  AVISO: no se pudo programar la copia diaria. Vuelve a ejecutar programar-copia.bat
  if /i not "%~1"=="auto" pause
  exit /b 1
)

echo  Copia diaria programada: todos los dias a las 21:30 (tarea "%TAREA%").
if /i not "%~1"=="auto" timeout /t 10
exit /b 0
