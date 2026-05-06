$ErrorActionPreference = "Stop"
$results = @()
function Add-Result($Name, $Passed, $Details) { $script:results += [PSCustomObject]@{ Test = $Name; Passed = $Passed; Details = $Details } }

try {
  $login = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/auth/login" -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
  $adminToken = $login.token
  Add-Result "Admin login" $true "Token issued"
} catch { Add-Result "Admin login" $false $_.Exception.Message }

$adminHeaders = @{ Authorization = "Bearer $adminToken" }
$operators = @()
$targetOperator = $null

try {
  $operators = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/company/operators" -Headers $adminHeaders
  $targetOperator = $operators | Select-Object -First 1
  Add-Result "List operators" $true ("count=" + $operators.Count)
} catch { Add-Result "List operators" $false $_.Exception.Message }

try {
  $adminAll = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/analytics/admin" -Headers $adminHeaders
  $allGridCount = @($adminAll.energyBalance.labels).Count
  Add-Result "Admin analytics all" $true ("gridLabels=" + $allGridCount)
} catch { Add-Result "Admin analytics all" $false $_.Exception.Message }

try {
  if ($null -eq $targetOperator) { throw "No operator available for filter test" }
  $opId = $targetOperator.id
  $adminFiltered = Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/analytics/admin?operatorId=" + $opId) -Headers $adminHeaders
  $energyFiltered = Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/analytics/energy-data?operatorId=" + $opId) -Headers $adminHeaders
  $aCount = @($adminFiltered.energyBalance.labels).Count
  $eCount = @($energyFiltered.grids).Count
  $pass = ($aCount -eq $eCount)
  Add-Result "Operator filter consistency (admin vs energy-data)" $pass ("adminLabels=" + $aCount + ", energyGrids=" + $eCount)
} catch { Add-Result "Operator filter consistency (admin vs energy-data)" $false $_.Exception.Message }

try {
  if ($null -eq $targetOperator) { throw "No operator available for alerts filter test" }
  $opId = $targetOperator.id
  $allAlerts = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/alerts" -Headers $adminHeaders
  $opAlerts = Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/alerts?operatorId=" + $opId) -Headers $adminHeaders
  $allowed = @($targetOperator.assignedMicrogrids | ForEach-Object { [int](($_ -replace "\D","")) })
  $outOfScope = @($opAlerts | Where-Object { $allowed -notcontains [int]$_.gridId }).Count
  $pass = ($outOfScope -eq 0 -and @($opAlerts).Count -le @($allAlerts).Count)
  Add-Result "Alerts operator scope filter" $pass ("all=" + @($allAlerts).Count + ", filtered=" + @($opAlerts).Count + ", outOfScope=" + $outOfScope)
} catch { Add-Result "Alerts operator scope filter" $false $_.Exception.Message }

try {
  $tariffBefore = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/company/billing/tariff-rate" -Headers $adminHeaders
  $newRate = [Math]::Round(([double]$tariffBefore.currentRate + 0.5), 2)
  $tariffBody = @{ rate = $newRate } | ConvertTo-Json -Compress
  $null = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/company/billing/tariff-rate" -Headers ($adminHeaders + @{ "Content-Type"="application/json" }) -Body $tariffBody
  $tariffAfter = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/company/billing/tariff-rate" -Headers $adminHeaders
  $pass = ([double]$tariffAfter.currentRate -eq [double]$newRate)
  Add-Result "Tariff update and readback" $pass ("before=" + $tariffBefore.currentRate + ", after=" + $tariffAfter.currentRate)
} catch { Add-Result "Tariff update and readback" $false $_.Exception.Message }

try {
  $summary = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/company/billing/summary" -Headers $adminHeaders
  $hasBills = ($summary.customerBills -is [System.Array])
  Add-Result "Billing summary endpoint" $hasBills ("customers=" + $summary.totalCustomers + ", rows=" + @($summary.customerBills).Count)
} catch { Add-Result "Billing summary endpoint" $false $_.Exception.Message }

try {
  if ($null -eq $targetOperator) { throw "No operator available for edit flow test" }
  $opId = $targetOperator.id
  $oldLoc = [string]$targetOperator.location
  $newLoc = $oldLoc + "-T"
  $body1 = @{ name = $targetOperator.name; password = $targetOperator.password; gridCount = [int]$targetOperator.gridCount; location = $newLoc } | ConvertTo-Json -Compress
  $null = Invoke-RestMethod -Method Put -Uri ("http://localhost:5000/company/operators/" + $opId) -Headers ($adminHeaders + @{ "Content-Type"="application/json" }) -Body $body1
  $body2 = @{ name = $targetOperator.name; password = $targetOperator.password; gridCount = [int]$targetOperator.gridCount; location = $oldLoc } | ConvertTo-Json -Compress
  $null = Invoke-RestMethod -Method Put -Uri ("http://localhost:5000/company/operators/" + $opId) -Headers ($adminHeaders + @{ "Content-Type"="application/json" }) -Body $body2
  Add-Result "Admin operator edit flow" $true "Update + revert succeeded"
} catch { Add-Result "Admin operator edit flow" $false $_.Exception.Message }

try {
  if ($null -eq $targetOperator) { throw "No operator available for customer edit test" }
  $opLoginBody = @{ username = $targetOperator.username; password = $targetOperator.password } | ConvertTo-Json -Compress
  $opLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/auth/login" -ContentType "application/json" -Body $opLoginBody
  $opHeaders = @{ Authorization = ("Bearer " + $opLogin.token) }
  $opCustomers = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/operator/customers" -Headers $opHeaders
  $cust = $opCustomers | Select-Object -First 1
  if ($null -eq $cust) { throw "No managed customer available" }
  $updateBody = @{ name = $cust.name; phone = $cust.phone; location = $cust.location } | ConvertTo-Json -Compress
  $null = Invoke-RestMethod -Method Put -Uri ("http://localhost:5000/operator/customer/" + $cust.id) -Headers ($opHeaders + @{ "Content-Type"="application/json" }) -Body $updateBody
  Add-Result "Operator customer edit flow" $true "Update succeeded"
} catch { Add-Result "Operator customer edit flow" $false $_.Exception.Message }

$results | Format-Table -AutoSize | Out-String
