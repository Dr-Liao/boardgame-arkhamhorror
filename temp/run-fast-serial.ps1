# 串行跑 fast 层：沙箱里 node --test 的并行子进程会 EPERM，逐文件起独立进程规避。
$ErrorActionPreference = 'Continue'
Set-Location 'G:\boardgame-hall-ai\games\arkhamhorror'
$json = & node -e "import('./tests/suites.mjs').then(m=>console.log(JSON.stringify(m.FAST_TESTS)))"
$files = @('suite-manifest.test.mjs') + ($json | ConvertFrom-Json)
$fail = New-Object System.Collections.ArrayList
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$index = 0
foreach ($f in $files) {
  $index++
  $out = & node "tests/$f" 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    [void]$fail.Add($f)
    Add-Content -Path 'temp\fast-serial.log' -Value "=== FAIL $f (exit $code) ==="
    ($out | Select-Object -Last 30) | ForEach-Object { Add-Content -Path 'temp\fast-serial.log' -Value $_ }
    Write-Host "FAIL $f"
  } else {
    Write-Host "ok $index/$($files.Count) $f"
  }
}
$summary = "SUMMARY files=$($files.Count) failed=$($fail.Count) elapsed=$([Math]::Round($sw.Elapsed.TotalSeconds,1))s"
Add-Content -Path 'temp\fast-serial.log' -Value $summary
if ($fail.Count) { Add-Content -Path 'temp\fast-serial.log' -Value ("FAILED FILES: " + ($fail -join ', ')) }
Write-Host $summary
Write-Host ("FAILED: " + ($fail -join ', '))
