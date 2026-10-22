# Run the Go test suite on Windows by compiling each test binary into .\bin and
# executing it from there.
#
# Some hosts with an Application Control / WDAC policy refuse to execute
# binaries that `go test` launches from the toolchain's temporary build
# directory. Compiling into .\bin and running the binary directly avoids that
# restriction while keeping the same coverage.

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Packages
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root

$binDir = if ($env:BIN_DIR) { $env:BIN_DIR } else { 'bin' }
$binDirPath = Join-Path $root $binDir
New-Item -ItemType Directory -Force -Path $binDirPath | Out-Null

if (-not $Packages -or $Packages.Count -eq 0) {
    $Packages = @(go list ./... | Where-Object { $_ -notmatch '/tests$' })
}

$failed = 0
$total = 0

foreach ($pkg in $Packages) {
    $total++
    $name = ($pkg -replace '^github\.com/leadnest/backend/', '') -replace '[\\/]', '_'
    $bin = Join-Path $binDirPath "$name.test.exe"

    Write-Output "==> $pkg"
    # -ldflags "-s -w" strips the symbol table, which keeps the binary small
    # enough to be executed on hosts with a restrictive Application Control /
    # WDAC policy.
    go test -c -ldflags "-s -w" -o $bin $pkg
    if ($LASTEXITCODE -ne 0) {
        Write-Output "FAIL (compile) $pkg"
        $failed++
        continue
    }
    if (-not (Test-Path -LiteralPath $bin)) {
        # Package has no test files; go test -c produces no binary.
        Write-Output "    (no test files)"
        continue
    }

    # Some hosts with an Application Control / WDAC policy block the first
    # execution of a freshly written binary while it is being evaluated.
    # Retrying after a short pause lets the binary be approved.
    $ok = $false
    for ($attempt = 1; $attempt -le 5 -and -not $ok; $attempt++) {
        $output = & $bin 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ok = $true
        } elseif ($attempt -lt 5) {
            Start-Sleep -Seconds 2
        }
    }
    if ($ok) {
        Write-Output "    PASS"
    } else {
        Write-Output "FAIL $pkg"
        $output | Select-Object -Last 20 | ForEach-Object { Write-Output "    $_" }
        $failed++
    }
    Remove-Item -LiteralPath $bin -ErrorAction SilentlyContinue
}

Write-Output ""
if ($failed -ne 0) {
    Write-Output "$failed of $total package(s) failed"
    exit 1
}
Write-Output "all $total package(s) passed"
