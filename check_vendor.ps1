$c = Get-Content -LiteralPath '.\app\vendor\[id]\vendor-client.tsx'
$open = ($c | Select-String -Pattern '\(' -SimpleMatch).Count
$close = ($c | Select-String -Pattern '\)' -SimpleMatch).Count
'Open parens: ' + $open
'Close parens: ' + $close
$openDiv = ($c | Select-String -Pattern '<div' -SimpleMatch).Count
$closeDiv = ($c | Select-String -Pattern '</div>' -SimpleMatch).Count
'Open divs: ' + $openDiv
'Close divs: ' + $closeDiv
