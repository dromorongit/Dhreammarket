$loginBody = @{ email = "dromornarh@dhreamarket.com"; password = "Cwdhroneonly@700700" } | ConvertTo-Json
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -WebSession $session
    Write-Host "LOGIN_RESPONSE:"
    $response | ConvertTo-Json -Depth 5
    Write-Host "COOKIES:"
    $session.Cookies.GetCookies("http://localhost:3000") | ForEach-Object { Write-Host "$($_.Name)=$($_.Value)" }
} catch {
    Write-Host "LOGIN_ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "RESPONSE_BODY: $($reader.ReadToEnd())"
    }
}
