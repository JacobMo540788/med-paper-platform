@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title MedFrontier 首次配置

echo ================================================
echo   MedFrontier 首次配置（只需运行一次）
echo ================================================
echo.
echo 提示：请先关闭所有 npm / dev 终端窗口，再按任意键继续...
pause >nul

echo.
echo [0/6] 结束可能占用文件的 Node 进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
echo [1/6] 启动数据库 Redis...
docker compose up -d postgres redis
if errorlevel 1 (
  echo 请先安装并打开 Docker Desktop
  pause
  exit /b 1
)
timeout /t 3 /nobreak >nul

echo.
echo [2/6] 初始化数据库...
call npm.cmd run db:push
call npm.cmd run db:seed

echo.
echo [3/6] 生成 Prisma 客户端（若失败请完全退出 Cursor 后重试）...
call npm.cmd run db:generate
if errorlevel 1 (
  echo.
  echo Prisma 生成失败 — 常见原因：文件被占用 或 项目在微信目录下被锁定
  echo 请尝试：
  echo   1. 完全退出 Cursor 和所有终端
  echo   2. 双击运行 scripts\fix-prisma-lock.cmd
  echo   3. 再次运行本脚本
  echo   4. 或将整个项目复制到 D:\med-paper-platform 再配置
  pause
  exit /b 1
)

echo.
echo [4/6] 构建网站（约 1-3 分钟）...
call npm.cmd run build
if errorlevel 1 (
  echo 构建失败，请截图报错
  pause
  exit /b 1
)

echo.
echo [5/6] 后台启动网站 + 自动抓取...
call npx pm2 delete med-web med-worker 2>nul
call npx pm2 start ecosystem.config.cjs
call npx pm2 save

echo.
echo [6/6] 打开浏览器...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ================================================
echo   配置完成！
echo   电脑: http://localhost:3000
echo   手机: http://你的电脑IP:3000  （同一 WiFi）
echo   可选: scripts\安装开机自启.cmd
echo ================================================
pause
