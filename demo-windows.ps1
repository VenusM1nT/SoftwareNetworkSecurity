$ErrorActionPreference = 'Stop'
function Run-Node([string[]]$Arguments) {
    Write-Host ('> node ' + ($Arguments -join ' ')) -ForegroundColor Cyan
    & node @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Node exited with code $LASTEXITCODE" }
}
$runtime = Join-Path ([IO.Path]::GetTempPath()) ('ex1b-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $runtime | Out-Null
Push-Location $runtime
try {
    Write-Host 'EX1B | Secure file transfer | Windows demonstration' -ForegroundColor Green
    Run-Node @('--version')
    foreach ($file in 'server.mjs','client.mjs','init.mjs','demo.mjs') {
        Run-Node @('--check', (Join-Path $PSScriptRoot $file))
    }
    Write-Host 'Syntax checks passed.'
    if ($env:EX1B_RECORD) { Start-Sleep 4 }
    Run-Node @((Join-Path $PSScriptRoot 'init.mjs'))
    if ($env:EX1B_RECORD) { Start-Sleep 4 }
    Run-Node @((Join-Path $PSScriptRoot 'demo.mjs'))
    Write-Host 'All checks passed.' -ForegroundColor Green
    if ($env:EX1B_RECORD) { Start-Sleep 8 }
} finally {
    Pop-Location
    if ((Split-Path $runtime -Parent) -eq [IO.Path]::GetTempPath().TrimEnd('\') -and
        (Split-Path $runtime -Leaf) -match '^ex1b-[0-9a-f-]{36}$') {
        Remove-Item -LiteralPath $runtime -Recurse -Force
    }
}
