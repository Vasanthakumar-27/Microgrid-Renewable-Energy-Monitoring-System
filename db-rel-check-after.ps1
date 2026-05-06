$ErrorActionPreference = "Stop"
$opId = "op-1777197260571"
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/auth/login" -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$headers = @{ Authorization = "Bearer $($login.token)" }
$list = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/company/operators" -Headers $headers
$target = $list | Where-Object { $_.id -eq $opId } | Select-Object -First 1
$exists = $null -ne $target
$gridCount = if ($exists) { ($target.assignedMicrogrids | Measure-Object).Count } else { 0 }
$opLoginOk = $false
if ($exists) {
  try {
    $payload = @{ username = $target.username; password = $target.password } | ConvertTo-Json -Compress
    $opLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/auth/login" -ContentType "application/json" -Body $payload
    $opLoginOk = [bool]($opLogin.token)
  } catch {
    $opLoginOk = $false
  }
}
"EXISTS_AFTER_RESTART=$exists"
"ASSIGNED_GRIDS_AFTER_RESTART=$gridCount"
"OPERATOR_USERNAME_AFTER_RESTART=" + ($target.username)
"OPERATOR_LOGIN_AFTER_RESTART=$opLoginOk"
