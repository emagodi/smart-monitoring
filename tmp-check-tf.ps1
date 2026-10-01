$ErrorActionPreference = 'Stop'
$body = @{ email = 'emagodi1@powertel.co.zw'; password = 'Password@123' } | ConvertTo-Json -Compress
$auth = Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/auth/authenticate' -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing
if ($auth.access_token) { $token = $auth.access_token } else { $token = $auth.data.accessToken }
$head = @{ Authorization = "Bearer $token" }
$resp = Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/transformers?page=0&size=20' -Headers $head -UseBasicParsing
Write-Host ('Root keys: ' + ($resp.PSObject.Properties.Name -join ','))
$list = $resp.content
if (-not $list) { $list = $resp.data }
if (-not $list) { $list = @($resp) }
Write-Host ('Rows: ' + $list.Count)
foreach ($t in ($list | Select-Object -First 5)) {
  $lv = if ($null -eq $t.lat) { 'NULL' } else { [string]$t.lat }
  $gv = if ($null -eq $t.lng) { 'NULL' } else { [string]$t.lng }
  $lt = if ($null -eq $t.lat) { 'null' } else { $t.lat.GetType().Name }
  $gt = if ($null -eq $t.lng) { 'null' } else { $t.lng.GetType().Name }
  Write-Host ('id=' + $t.id + ' name=' + $t.name + ' lat=' + $lv + '(' + $lt + ') lng=' + $gv + '(' + $gt + ')')
}
