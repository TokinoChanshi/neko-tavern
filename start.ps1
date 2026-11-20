$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules')) {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw '依赖安装失败' }
}
pnpm build
if ($LASTEXITCODE -ne 0) { throw '构建失败' }
node server/index.mjs
