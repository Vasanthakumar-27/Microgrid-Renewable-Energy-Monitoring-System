$ErrorActionPreference = "Stop"
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/auth/login" -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$headers = @{ Authorization = "Bearer $($login.token)" }
$name = "DBRelOp" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$body = @{ name = $name; password = "dbrel123"; gridCount = 1; location = "DB Zone" } | ConvertTo-Json -Compress
$created = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/company/operators" -Headers ($headers + @{ "Content-Type"="application/json" }) -Body $body
$opId = $created.operator.id
$list1 = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/company/operators" -Headers $headers
$op1 = $list1 | Where-Object { $_.id -eq $opId } | Select-Object -First 1
$loginOp = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/auth/login" -ContentType "application/json" -Body (@{ username = $created.operator.username; password = "dbrel123" } | ConvertTo-Json -Compress)
"CREATED_OP=$opId"
"ASSIGNED_GRIDS_BEFORE_RESTART=" + (($op1.assignedMicrogrids | Measure-Object).Count)
"OPERATOR_LOGIN_BEFORE_RESTART=" + ([bool]($loginOp.token))
