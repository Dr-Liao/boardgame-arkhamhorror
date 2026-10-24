param([Parameter(Mandatory=$true)][string]$Uri, [Parameter(Mandatory=$true)][string]$OutFile)
$ErrorActionPreference = 'Stop'
if (-not $Uri.StartsWith('https://incompetech.com/music/royalty-free/mp3-royaltyfree/')) { throw 'Unexpected download host' }
Invoke-WebRequest -Uri $Uri -OutFile $OutFile -TimeoutSec 120 -UseBasicParsing
