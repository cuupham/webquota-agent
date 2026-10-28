$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot
try {
  if (-not (Test-Path '.env')) {
    throw 'Missing .env. Run .\scripts\setup.ps1 first.'
  }
  npm start
} finally {
  Pop-Location
}
