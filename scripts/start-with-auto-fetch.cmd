@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo ========================================
echo  MedFrontier 一键启动（网站 + 每日自动抓取）
echo  每天北京时间 07:00 自动更新，无需手动操作
echo ========================================
echo.
echo [1/2] 检查 Redis...
docker compose up -d redis postgres 2>nul
if errorlevel 1 (
  echo 警告: Docker 未启动，请先打开 Docker Desktop
  pause
  exit /b 1
)
echo.
echo [2/2] 启动网站与定时任务（关闭窗口即停止）...
call npm run dev:all
