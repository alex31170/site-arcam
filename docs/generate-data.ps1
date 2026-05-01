$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$imageExts = @('.jpg', '.jpeg', '.png', '.webp', '.gif')
$documentExts = @('.pdf')

if (-not (Test-Path -LiteralPath (Join-Path $root 'entete.png'))) {
  $sourceHeader = Join-Path $root 'EXPOSITION.jpg'
  if (Test-Path -LiteralPath $sourceHeader) {
    Copy-Item -LiteralPath $sourceHeader -Destination (Join-Path $root 'entete.png')
  }
}

$rootUri = New-Object System.Uri (($root.TrimEnd('\') + '\'))

function To-Rel([string]$fullPath) {
  $uri = New-Object System.Uri $fullPath
  $rel = [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($uri).ToString())
  return ($rel -replace '\\', '/')
}

function Html-Attr([string]$value) {
  return $value.
    Replace('&', '&amp;').
    Replace('"', '&quot;').
    Replace('<', '&lt;').
    Replace('>', '&gt;')
}

function Get-ImageFiles([string]$dir) {
  Get-ChildItem -LiteralPath $dir -File |
    Where-Object { $imageExts -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name
}

function Get-DocumentFiles([string]$dir) {
  Get-ChildItem -LiteralPath $dir -File |
    Where-Object { $documentExts -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name
}

function Find-MainImage([System.IO.DirectoryInfo]$dir) {
  $sibling = Get-ImageFiles $dir.Parent.FullName |
    Where-Object { $_.BaseName -ieq $dir.Name } |
    Select-Object -First 1

  if ($sibling) {
    return (To-Rel $sibling.FullName)
  }

  $inside = Get-ImageFiles $dir.FullName | Select-Object -First 1
  if ($inside) {
    return (To-Rel $inside.FullName)
  }

  return $null
}

function Build-Node([System.IO.DirectoryInfo]$dir) {
  $children = @(Get-ChildItem -LiteralPath $dir.FullName -Directory | Sort-Object Name | ForEach-Object { Build-Node $_ })
  $gallery = @(Get-ImageFiles $dir.FullName | ForEach-Object { To-Rel $_.FullName })
  $documents = @(Get-DocumentFiles $dir.FullName | ForEach-Object { To-Rel $_.FullName })

  [ordered]@{
    name = $dir.Name
    path = (To-Rel $dir.FullName)
    image = (Find-MainImage $dir)
    gallery = $gallery
    documents = $documents
    children = $children
  }
}

$rootGallery = @(Get-ImageFiles $root | Where-Object { $_.Name -ine 'entete.png' } | ForEach-Object { To-Rel $_.FullName })
$rootDocuments = @(Get-DocumentFiles $root | ForEach-Object { To-Rel $_.FullName })
$data = [ordered]@{
  title = ''
  header = 'entete.png'
  path = ''
  name = 'Accueil'
  image = $null
  gallery = $rootGallery
  documents = $rootDocuments
  children = @(Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name | ForEach-Object { Build-Node $_ })
}

($data | ConvertTo-Json -Depth 100) | Set-Content -LiteralPath (Join-Path $root 'data.json') -Encoding utf8
$json = $data | ConvertTo-Json -Depth 100 -Compress
"window.SITE_DATA = $json;" | Set-Content -LiteralPath (Join-Path $root 'data.js') -Encoding utf8

$template = @'
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Accueil</title>
  <link rel="stylesheet" href="__ROOT__/style.css">
  <script src="__ROOT__/data.js" defer></script>
  <script src="__ROOT__/script.js" defer></script>
</head>
<body data-root="__ROOT__" data-path="__PATH__">
  <noscript>Ce site a besoin de JavaScript pour afficher les pages et les images.</noscript>
</body>
</html>
'@

Get-ChildItem -LiteralPath $root -Directory -Recurse | ForEach-Object {
  $rel = To-Rel $_.FullName
  $depth = ($rel -split '/').Count
  $prefixParts = @()
  for ($i = 0; $i -lt $depth; $i += 1) {
    $prefixParts += '..'
  }

  $html = $template.Replace('__ROOT__', ($prefixParts -join '/')).Replace('__PATH__', (Html-Attr $rel))
  Set-Content -LiteralPath (Join-Path $_.FullName 'index.html') -Value $html -Encoding utf8
}

Write-Host 'data.json et index.html de dossiers regeneres.'
