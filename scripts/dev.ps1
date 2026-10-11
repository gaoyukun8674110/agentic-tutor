$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot

Write-Host 'Starting backend at http://localhost:8001'
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location -LiteralPath '$Root\backend'; if (Test-Path '.\.venv\Scripts\python.exe') { .\.venv\Scripts\python.exe start.py } else { python start.py }"
)

Write-Host 'Starting frontend at http://localhost:4173'
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location -LiteralPath '$Root\frontend'; npm.cmd run dev"
)
