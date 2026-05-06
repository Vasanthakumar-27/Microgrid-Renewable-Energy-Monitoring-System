$ErrorActionPreference = "Stop"
$results = @()
function Add-Result($Name, $Passed, $Details) { $script:results += [PSCustomObject]@{ Test = $Name; Passed = $Passed; Details = $Details } }

$login = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/auth/login" -ContentType "application/json" -Body '{"username":"customer","password":"customer123"}'
$headers = @{ Authorization = "Bearer $($login.token)" }
$customerId = $login.customerId

try {
  $summary = Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/customer/" + $customerId + "/bill-summary") -Headers $headers
  $pass = ($summary.currency -eq "INR")
  Add-Result "Bill summary currency INR" $pass ("currency=" + $summary.currency)
} catch { Add-Result "Bill summary currency INR" $false $_.Exception.Message }

try {
  $history = Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/customer/" + $customerId + "/payments/history?limit=10") -Headers $headers
  $rows = @($history.payments)
  $allInr = $true
  foreach ($row in $rows) {
    if ([string]$row.currency -ne "INR") { $allInr = $false; break }
  }
  Add-Result "Payment history row currency INR" $allInr ("rows=" + $rows.Count)
} catch { Add-Result "Payment history row currency INR" $false $_.Exception.Message }

try {
  $summary = Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/customer/" + $customerId + "/bill-summary") -Headers $headers
  $payload = @{ customerId = $customerId; amount = 10; month = $summary.month; currency = "USD"; method = "ONLINE" } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri "http://localhost:5000/customer/payment" -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $payload | Out-Null
  Add-Result "Reject non-INR payment" $false "USD request unexpectedly accepted"
} catch {
  $msg = $_.ErrorDetails.Message
  $isExpected = $msg -like '*Only INR payments are supported*'
  Add-Result "Reject non-INR payment" $isExpected ($msg)
}

$results | Format-Table -AutoSize | Out-String
