@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 正在结束可能占用文件的 Node 进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo 正在删除旧的 Prisma 引擎缓存...
if exist "node_modules\.prisma\client\query_engine-windows.dll.node" del /f /q "node_modules\.prisma\client\query_engine-windows.dll.node" 2>nul
if exist "node_modules\.prisma\client\*.tmp*" del /f /q "node_modules\.prisma\client\*.tmp*" 2>nul
echo 正在重新生成 Prisma 客户端...
call npm.cmd run db:generate
if errorlevel 1 (
  echo.
  echo 仍失败：请【完全退出 Cursor】后，再双击本脚本。
  echo 若项目在「微信文件」目录，建议复制到 D:\med-paper-platform
  pause
  exit /b 1
)
echo.
echo 完成！请双击: scripts\首次配置-常驻运行.cmd
pause
