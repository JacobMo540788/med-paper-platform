Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
projectDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(scriptDir)
cmd = "cmd /c cd /d """ & projectDir & """ && docker compose up -d postgres redis >nul 2>&1 && npx pm2 resurrect >nul 2>&1"
WshShell.Run cmd, 0, False
