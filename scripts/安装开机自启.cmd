@echo off
chcp 65001 >nul
cd /d "%~dp0.."

set "VBS=%~dp0后台启动-无窗口.vbs"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LINK=%STARTUP%\MedFrontier-自动启动.lnk"

powershell -NoProfile -Command ^
  "$s = New-Object -ComObject WScript.Shell; ^
   $l = $s.CreateShortcut('%LINK%'); ^
   $l.TargetPath = 'wscript.exe'; ^
   $l.Arguments = '\"\"%VBS%\"\"'; ^
   $l.WorkingDirectory = '%CD%'; ^
   $l.WindowStyle = 7; ^
   $l.Description = 'MedFrontier 网站与每日抓取'; ^
   $l.Save()"

echo 已添加到 Windows 开机自启：
echo %LINK%
echo.
echo 下次开机将自动在后台启动网站（需 Docker Desktop 也设为开机启动）
pause
