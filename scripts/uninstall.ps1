[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  # Also remove the API key/config and the dedicated Playwright profile (including its login session).
  [switch]$RemoveLocalData
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot

try {
  $listeners = @()
  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $listeners = @(Get-NetTCPConnection -LocalPort 4153 -State Listen -ErrorAction SilentlyContinue)
  }
  if ($listeners.Count -gt 0) {
    $pids = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
    throw "Port 4153 still has a listening process (PID: $pids). Stop WebQuota Agent with Ctrl+C in its running terminal, then rerun uninstall."
  }

  $targets = @(
    @{ Path = (Join-Path $projectRoot 'node_modules'); Label = 'Node.js dependencies' },
    @{ Path = (Join-Path $projectRoot 'dist'); Label = 'Generated build output' }
  )

  if ($RemoveLocalData) {
    $targets += @(
      @{ Path = (Join-Path $projectRoot '.env'); Label = 'Local API key and configuration' },
      @{ Path = (Join-Path $projectRoot 'browser-profile'); Label = 'Dedicated browser profile and login session' }
    )
  } else {
    Write-Host 'Keeping .env and browser-profile. They contain your API key/configuration and browser session.'
    Write-Host 'Pass -RemoveLocalData only if you also want those local data removed.'
  }

  foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target.Path) {
      if ($PSCmdlet.ShouldProcess($target.Path, 'Remove ' + $target.Label)) {
        Remove-Item -LiteralPath $target.Path -Recurse -Force
        Write-Host ('Removed: ' + $target.Label)
      }
    } else {
      Write-Host ('Not present: ' + $target.Label)
    }
  }

  Write-Host ''
  Write-Host 'WebQuota Agent local dependencies/build output have been removed.'
  Write-Host 'This script does not uninstall Node.js, Git, PowerShell, or the shared Playwright browser cache.'
  Write-Host 'The source repository remains intact.'
} finally {
  Pop-Location
}
