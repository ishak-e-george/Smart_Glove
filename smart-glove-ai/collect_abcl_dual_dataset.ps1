param(
    [string]$LeftPort = "COM4",
    [string]$RightPort = "COM5",
    [int]$RowsPerBatch = 200,
    [int]$Rounds = 5,
    [string[]]$Labels = @("A", "B", "C", "L")
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Collector = Join-Path $Root "python\collect_asl_alphabet_data.py"
$DataDir = Join-Path $Root "data\external\asl_alphabet"
$LeftCsv = Join-Path $DataDir "left_asl_alphabet_5finger.csv"
$RightCsv = Join-Path $DataDir "right_asl_alphabet_5finger.csv"

if (!(Test-Path $Python)) {
    throw "Python venv not found: $Python"
}

if (!(Test-Path $Collector)) {
    throw "Collector script not found: $Collector"
}

New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

Write-Host "======================================================="
Write-Host " Smart Glove ABCL Dual-Glove Dataset Collection"
Write-Host " Left port     : $LeftPort"
Write-Host " Right port    : $RightPort"
Write-Host " Labels        : $($Labels -join ', ')"
Write-Host " Rounds        : $Rounds"
Write-Host " Rows/batch    : $RowsPerBatch"
Write-Host " Total/label   : $($Rounds * $RowsPerBatch)"
Write-Host " Left CSV      : $LeftCsv"
Write-Host " Right CSV     : $RightCsv"
Write-Host "======================================================="
Write-Host ""
Write-Host "Close Serial Monitor and stop the WebSocket bridge before continuing."
Read-Host "Press Enter when COM ports are free"

foreach ($round in 1..$Rounds) {
    Write-Host ""
    Write-Host "================ ROUND $round / $Rounds ================"

    foreach ($label in $Labels) {
        Write-Host ""
        Write-Host "[LEFT] Round $round - Collect label $label"
        Write-Host "Put the LEFT glove in gesture '$label', hold it naturally, then follow the collector prompt."
        & $Python $Collector --port $LeftPort --label $label --rows $RowsPerBatch --csv $LeftCsv
        if ($LASTEXITCODE -ne 0) { throw "Left collection failed for label $label in round $round" }

        Write-Host ""
        Write-Host "[RIGHT] Round $round - Collect label $label"
        Write-Host "Put the RIGHT glove in gesture '$label', hold it naturally, then follow the collector prompt."
        & $Python $Collector --port $RightPort --label $label --rows $RowsPerBatch --csv $RightCsv
        if ($LASTEXITCODE -ne 0) { throw "Right collection failed for label $label in round $round" }
    }
}

Write-Host ""
Write-Host "Collection finished."
Write-Host "Left dataset : $LeftCsv"
Write-Host "Right dataset: $RightCsv"
Write-Host ""
Write-Host "Train left model:"
Write-Host ".venv\Scripts\python.exe python\train_asl_alphabet_model.py --data data\external\asl_alphabet\left_asl_alphabet_5finger.csv --model-out models\asl_left_alphabet_model.joblib"
Write-Host ""
Write-Host "Train right model:"
Write-Host ".venv\Scripts\python.exe python\train_asl_alphabet_model.py --data data\external\asl_alphabet\right_asl_alphabet_5finger.csv --model-out models\asl_right_alphabet_model.joblib"
