param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

Write-Host "==> Checking prerequisites"
Require-Command "node"
Require-Command "npm"
Require-Command "code"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $SkipInstall) {
  Write-Host "==> Installing dependencies"
  npm install
}

Write-Host "==> Compiling extension"
npm run compile

Write-Host "==> Launching Extension Development Host"
code . --extensionDevelopmentPath="$repoRoot" --new-window

Write-Host "==> Done"
