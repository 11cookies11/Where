param(
  [string]$CasesPath = 'testcases/where-skill-prompts.jsonl',
  [string]$RunsPath = 'testcases/where-skill-runs.jsonl',
  [string]$OutPath = 'reports/where-skill-eval-latest.md',
  [double]$MinPrecision = 0.0,
  [double]$MinRecall = 0.0,
  [double]$MinSuccessRate = 0.0,
  [double]$MinRecoveryRate = 0.0
)

function Read-Jsonl([string]$path) {
  if (-not (Test-Path $path)) { throw "File not found: $path" }
  $items = @()
  Get-Content -Encoding UTF8 $path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0) { return }
    $items += ($line | ConvertFrom-Json)
  }
  return $items
}

$cases = Read-Jsonl $CasesPath
$runs = Read-Jsonl $RunsPath

$runMap = @{}
foreach ($r in $runs) { $runMap[$r.id] = $r }

$tp = 0; $fp = 0; $tn = 0; $fn = 0
$successCount = 0
$recoveryTotal = 0
$recoverySuccess = 0
$totalTime = 0.0
$timeCount = 0
$missingRuns = New-Object System.Collections.Generic.List[string]
$failedCases = New-Object System.Collections.Generic.List[string]

foreach ($c in $cases) {
  if (-not $runMap.ContainsKey($c.id)) {
    $missingRuns.Add($c.id)
    continue
  }

  $r = $runMap[$c.id]
  $triggered = [bool]$r.triggered
  $shouldTrigger = [bool]$c.should_trigger

  if ($triggered -and $shouldTrigger) { $tp++ }
  elseif ($triggered -and -not $shouldTrigger) { $fp++ }
  elseif ((-not $triggered) -and (-not $shouldTrigger)) { $tn++ }
  else { $fn++ }

  if ($r.success -eq $true) { $successCount++ }
  else { $failedCases.Add($c.id) }

  if ($c.category -eq 'error_injection') {
    $recoveryTotal++
    if ($r.recovered -eq $true) { $recoverySuccess++ }
  }

  if ($null -ne $r.time_seconds) {
    $totalTime += [double]$r.time_seconds
    $timeCount++
  }
}

$precision = if (($tp + $fp) -gt 0) { $tp / ($tp + $fp) } else { 0 }
$recall = if (($tp + $fn) -gt 0) { $tp / ($tp + $fn) } else { 0 }
$successRate = if ($cases.Count -gt 0) { $successCount / $cases.Count } else { 0 }
$recoveryRate = if ($recoveryTotal -gt 0) { $recoverySuccess / $recoveryTotal } else { 0 }
$avgTime = if ($timeCount -gt 0) { $totalTime / $timeCount } else { 0 }

$missingText = if ($missingRuns.Count -gt 0) {
  ($missingRuns | ForEach-Object { "- $_" }) -join "`n"
} else {
  '- none'
}

$failedText = if ($failedCases.Count -gt 0) {
  ($failedCases | Sort-Object -Unique | ForEach-Object { "- $_" }) -join "`n"
} else {
  '- none'
}

$reportTemplate = @'
# Where Skill Evaluation Report

- Cases file: {5}
- Runs file: {6}
- Total cases: {7}
- Evaluated runs: {8}
- Missing runs: {9}

## Trigger Metrics

- TP: {10}
- FP: {11}
- TN: {12}
- FN: {13}
- Precision: {0:P2}
- Recall: {1:P2}

## Outcome Metrics

- Task Success Rate: {2:P2}
- Recovery Success Rate: {3:P2}
- Average Time-to-Fix (seconds): {4:N2}

## Missing Runs

{14}

## Failed Cases

{15}
'@

$report = $reportTemplate -f $precision, $recall, $successRate, $recoveryRate, $avgTime, $CasesPath, $RunsPath, $cases.Count, $runs.Count, $missingRuns.Count, $tp, $fp, $tn, $fn, $missingText, $failedText

$report | Set-Content -Encoding UTF8 $OutPath
Write-Output "Report written: $OutPath"
Write-Output ("Precision={0:P2}, Recall={1:P2}, Success={2:P2}, Recovery={3:P2}" -f $precision, $recall, $successRate, $recoveryRate)

$thresholdFailures = New-Object System.Collections.Generic.List[string]
if ($precision -lt $MinPrecision) { $thresholdFailures.Add(("Precision {0:P2} < target {1:P2}" -f $precision, $MinPrecision)) }
if ($recall -lt $MinRecall) { $thresholdFailures.Add(("Recall {0:P2} < target {1:P2}" -f $recall, $MinRecall)) }
if ($successRate -lt $MinSuccessRate) { $thresholdFailures.Add(("Task Success Rate {0:P2} < target {1:P2}" -f $successRate, $MinSuccessRate)) }
if ($recoveryRate -lt $MinRecoveryRate) { $thresholdFailures.Add(("Recovery Success Rate {0:P2} < target {1:P2}" -f $recoveryRate, $MinRecoveryRate)) }

if ($thresholdFailures.Count -gt 0) {
  Write-Output "KPI gate: FAILED"
  $thresholdFailures | ForEach-Object { Write-Output ("- " + $_) }
  exit 1
}

Write-Output "KPI gate: PASSED"
