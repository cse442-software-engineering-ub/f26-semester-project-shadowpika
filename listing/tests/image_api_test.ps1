[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https?://')]
    [string] $BaseUrl,

    [string] $ValidImagePath = ''
)

$ErrorActionPreference = 'Stop'

function Assert-Equal {
    param(
        [Parameter(Mandatory = $true)] $Expected,
        [Parameter(Mandatory = $true)] $Actual,
        [Parameter(Mandatory = $true)] [string] $Message
    )

    if ($Expected -ne $Actual) {
        throw "$Message Expected '$Expected' but received '$Actual'."
    }
}

function Assert-True {
    param(
        [Parameter(Mandatory = $true)] [bool] $Condition,
        [Parameter(Mandatory = $true)] [string] $Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Invoke-JsonRequest {
    param(
        [Parameter(Mandatory = $true)] [string[]] $CurlArguments,
        [Parameter(Mandatory = $true)] [int] $ExpectedStatus
    )

    $marker = '__KARAVAN_HTTP_STATUS__'
    $rawResponse = (& curl.exe -sS @CurlArguments -w "$marker%{http_code}") -join "`n"
    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe failed with exit code $LASTEXITCODE."
    }

    $markerIndex = $rawResponse.LastIndexOf($marker, [StringComparison]::Ordinal)
    if ($markerIndex -lt 0) {
        throw 'The HTTP response did not include a status code.'
    }

    $body = $rawResponse.Substring(0, $markerIndex)
    $status = [int] $rawResponse.Substring($markerIndex + $marker.Length)
    if ($status -ne $ExpectedStatus) {
        throw "Unexpected HTTP status. Expected '$ExpectedStatus' but received '$status'. Body: $body"
    }

    try {
        $payload = $body | ConvertFrom-Json
    } catch {
        throw "The endpoint did not return valid JSON. Body: $body"
    }

    return $payload
}

$moduleRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $moduleRoot '..'))

if ([string]::IsNullOrWhiteSpace($ValidImagePath)) {
    $ValidImagePath = Join-Path $repositoryRoot 'karavan-login\src\assets\hero.png'
}
$ValidImagePath = [IO.Path]::GetFullPath($ValidImagePath)

if (-not (Test-Path -LiteralPath $ValidImagePath -PathType Leaf)) {
    throw "Valid test image not found: $ValidImagePath"
}

$invalidFilePath = Join-Path $repositoryRoot 'READ_ME.txt'
if (-not (Test-Path -LiteralPath $invalidFilePath -PathType Leaf)) {
    throw "Invalid-file fixture not found: $invalidFilePath"
}

$listingBaseUrl = $BaseUrl.TrimEnd('/')
$uploadUrl = "$listingBaseUrl/api/upload_image.php"
$imageEndpoint = "$listingBaseUrl/api/image.php"
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("karavan-listing-image-test-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

try {
    Write-Host 'Test 1: valid image upload and retrieval'
    $uploaded = Invoke-JsonRequest -CurlArguments @(
        '-F', "image=@$ValidImagePath",
        $uploadUrl
    ) -ExpectedStatus 201

    Assert-True -Condition ([bool] $uploaded.success) -Message 'The valid upload did not report success.'
    Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($uploaded.image_url)) -Message 'The upload did not return image_url.'
    Assert-Equal -Expected 'image/png' -Actual $uploaded.image.mime_type -Message 'The returned MIME type is incorrect.'
    Assert-True -Condition ($uploaded.image.filename -match '^[a-f0-9]{32}\.png$') -Message 'The server filename is not randomized correctly.'

    $imageUrl = [Uri]::new([Uri] $uploadUrl, [string] $uploaded.image_url).AbsoluteUri
    $downloadPath = Join-Path $temporaryDirectory 'downloaded.png'
    $downloadStatus = (& curl.exe -sS -o $downloadPath -w '%{http_code}' $imageUrl) -join ''
    if ($LASTEXITCODE -ne 0) {
        throw "Downloading the stored image failed with exit code $LASTEXITCODE."
    }
    Assert-Equal -Expected '200' -Actual $downloadStatus -Message 'The stored image was not served.'
    Assert-Equal -Expected (Get-FileHash -Algorithm SHA256 -LiteralPath $ValidImagePath).Hash `
        -Actual (Get-FileHash -Algorithm SHA256 -LiteralPath $downloadPath).Hash `
        -Message 'The downloaded image differs from the uploaded image.'
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 2: missing image rejection'
    $missing = Invoke-JsonRequest -CurlArguments @('-X', 'POST', $uploadUrl) -ExpectedStatus 400
    Assert-True -Condition (-not [bool] $missing.success) -Message 'A request without an image was accepted.'
    Assert-Equal -Expected 'No listing image was provided.' -Actual $missing.error -Message 'Missing-image error is incorrect.'
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 3: non-image rejection'
    $invalid = Invoke-JsonRequest -CurlArguments @(
        '-F', "image=@$invalidFilePath",
        $uploadUrl
    ) -ExpectedStatus 415
    Assert-True -Condition (-not [bool] $invalid.success) -Message 'A non-image file was accepted.'
    Assert-Equal -Expected 'Only JPEG, PNG, and WebP images are allowed.' -Actual $invalid.error -Message 'Invalid-type error is incorrect.'
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 4: oversized image rejection'
    $oversizedPath = Join-Path $temporaryDirectory 'over-5mb.png'
    $oversizedStream = [IO.File]::Create($oversizedPath)
    try {
        $oversizedStream.SetLength((5 * 1024 * 1024) + 1)
    } finally {
        $oversizedStream.Dispose()
    }

    $oversized = Invoke-JsonRequest -CurlArguments @(
        '-F', "image=@$oversizedPath",
        $uploadUrl
    ) -ExpectedStatus 413
    Assert-True -Condition (-not [bool] $oversized.success) -Message 'An oversized image was accepted.'
    Assert-Equal -Expected 'The image must be 5 MB or smaller.' -Actual $oversized.error -Message 'Oversized-image error is incorrect.'
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 5: path traversal rejection'
    $traversal = Invoke-JsonRequest -CurlArguments @(
        "$imageEndpoint`?file=..%2F..%2Flogin.php"
    ) -ExpectedStatus 400
    Assert-True -Condition (-not [bool] $traversal.success) -Message 'A path traversal request was accepted.'
    Assert-Equal -Expected 'A valid image file is required.' -Actual $traversal.error -Message 'Path-validation error is incorrect.'
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'All listing image API tests passed.' -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
