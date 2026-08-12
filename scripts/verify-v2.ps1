$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

& .\.venv\Scripts\genvm-lint.exe check .\contracts\match_round_resolver.py
if ($LASTEXITCODE -ne 0) { throw "Resolver lint failed." }
& .\.venv\Scripts\genvm-lint.exe check .\contracts\moment_grid_game.py
if ($LASTEXITCODE -ne 0) { throw "Game lint failed." }
& .\.venv\Scripts\python.exe -m pytest .\tests\direct -q
if ($LASTEXITCODE -ne 0) { throw "Direct tests failed." }
pnpm.cmd --filter @moment-grid/scoring test
if ($LASTEXITCODE -ne 0) { throw "Scoring tests failed." }
pnpm.cmd --filter web lint
if ($LASTEXITCODE -ne 0) { throw "Web lint failed." }
pnpm.cmd --filter web typecheck
if ($LASTEXITCODE -ne 0) { throw "Web typecheck failed." }
pnpm.cmd --filter web build
if ($LASTEXITCODE -ne 0) { throw "Web build failed." }
