[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  # Also remove the API key/config and any legacy Playwright profile from older versions.
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
    $processIds = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
    throw "Port 4153 still has a listening process (PID: $processIds). Stop WebQuota Agent with Ctrl+C in its running terminal, then rerun uninstall."
  }

  $targets = @(
    @{ Path = (Join-Path $projectRoot 'node_modules'); Label = 'Node.js dependencies' },
    @{ Path = (Join-Path $projectRoot 'dist'); Label = 'Generated build output' }
  )

  if ($RemoveLocalData) {
    $targets += @(
      @{ Path = (Join-Path $projectRoot '.env'); Label = 'Local API key and configuration' },
      @{ Path = (Join-Path $projectRoot 'browser-profile'); Label = 'Legacy Playwright browser profile, if present' }
    )
  } else {
    Write-Host 'Keeping .env and any legacy browser-profile folder.'
    Write-Host 'Pass -RemoveLocalData only if you also want local configuration and legacy browser data removed.'
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
  Write-Host 'To remove the Chrome extension and its saved API key, open chrome://extensions and remove WebQuota Agent Bridge.'
  Write-Host 'This script does not uninstall Node.js, Git, or Chrome.'
} finally {
  Pop-Location
}
