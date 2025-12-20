# Create Desktop Shortcut for Talk Show Go
# Run this once to create a shortcut on your desktop

$WshShell = New-Object -ComObject WScript.Shell

# Get desktop path
$DesktopPath = [Environment]::GetFolderPath("Desktop")

# Create shortcut
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Talk Show Go.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$PSScriptRoot\start.ps1`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Start Talk Show Go"
$Shortcut.IconLocation = "shell32.dll,12" # Crown/King icon

# Save shortcut
$Shortcut.Save()

Write-Host ""
Write-Host "  Shortcut created on Desktop!" -ForegroundColor Green
Write-Host ""
Write-Host "  Double-click 'Talk Show Go' on your desktop to start the app." -ForegroundColor Cyan
Write-Host ""
