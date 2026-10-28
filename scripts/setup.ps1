$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22+ is required. Install it from https://nodejs.org/'
  }
  $nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
  if ($nodeMajor -lt 22) {
    throw "Node.js 22+ is required; found $(node --version)."
  }

  if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $rng.GetBytes($bytes)
    } finally {
      $rng.Dispose()
    }
    $key = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    $envText = Get-Content '.env' -Raw
    $envText = $envText -replace '(?m)^WEBQUOTA_API_KEY=.*$', "WEBQUOTA_API_KEY=$key"
    Set-Content -Path '.env' -Value $envText -NoNewline -Encoding utf8
    Write-Host 'Created .env with a generated local API key.'
  } else {
    Write-Host 'Keeping existing .env; it was not overwritten.'
  }

  npm install
  npx playwright install chromium
  npm run check
  Write-Host 'Setup complete. Start with .\scripts\start.ps1'
} finally {
  Pop-Location
}
