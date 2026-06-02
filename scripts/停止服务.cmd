@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 正在停止 MedFrontier 后台服务...
call npx pm2 stop all
echo 已停止。要再次启动请双击: 首次配置-常驻运行.cmd 或重启电脑（若已安装开机自启）
pause
