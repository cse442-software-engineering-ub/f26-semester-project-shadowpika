[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https?://')]
    [string] $ProjectBaseUrl
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

    $temporaryResponse = [IO.Path]::GetTempFileName()
    try {
        # Windows PowerShell 5.1 can decode native command output with the
        # console code page. Saving the response and reading it explicitly as
        # UTF-8 prevents characters such as the middle dot from becoming ┬╖.
        $statusText = (& curl.exe -sS @CurlArguments -o $temporaryResponse -w '%{http_code}') -join ''
        if ($LASTEXITCODE -ne 0) {
            throw "curl.exe failed with exit code $LASTEXITCODE."
        }

        $status = [int] $statusText
        $body = [IO.File]::ReadAllText($temporaryResponse, [Text.Encoding]::UTF8)

        if ($status -ne $ExpectedStatus) {
            throw "Unexpected HTTP status. Expected '$ExpectedStatus' but received '$status'. Body: $body"
        }

        try {
            $payload = $body | ConvertFrom-Json
        } catch {
            throw "The endpoint did not return valid JSON. Body: $body"
        }

        return $payload
    } finally {
        if (Test-Path -LiteralPath $temporaryResponse) {
            Remove-Item -LiteralPath $temporaryResponse -Force
        }
    }
}

function Post-Json {
    param(
        [Parameter(Mandatory = $true)] [string] $Url,
        [Parameter(Mandatory = $true)] [string] $Body,
        [Parameter(Mandatory = $true)] [int] $ExpectedStatus
    )

    $temporaryJson = [IO.Path]::GetTempFileName()
    try {
        $utf8WithoutBom = New-Object Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($temporaryJson, $Body, $utf8WithoutBom)

        return Invoke-JsonRequest -CurlArguments @(
            '-X', 'POST',
            '-H', 'Content-Type: application/json',
            '--data-binary', "@$temporaryJson",
            $Url
        ) -ExpectedStatus $ExpectedStatus
    } finally {
        if (Test-Path -LiteralPath $temporaryJson) {
            Remove-Item -LiteralPath $temporaryJson -Force
        }
    }
}

$baseUrl = $ProjectBaseUrl.TrimEnd('/')
$createUrl = "$baseUrl/listing/api/create_listing.php"
$getListingUrl = "$baseUrl/listing/api/get_listing.php"
$uniqueSuffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$title = "Color Workbook API Test $uniqueSuffix"
$separator = [char] 0x00B7
$relatedCourse = "ART 105 $separator Color Theory"
$meetingLocation = "Capen Hall $separator Main entrance"

Write-Host 'Test 1: create and persist a valid listing'
$validBody = @{
    title = $title
    category = 'Textbooks'
    condition = 'Like New'
    price = '40.00'
    related_course = $relatedCourse
    meeting_location = $meetingLocation
    description = 'Fourth edition by Becky Koenig M.F.A. Like new with no markings.'
} | ConvertTo-Json -Compress

$created = Post-Json -Url $createUrl -Body $validBody -ExpectedStatus 201
Assert-True -Condition ([bool] $created.success) -Message 'The valid listing did not report success.'
Assert-Equal -Expected 'Your listing was published.' -Actual $created.message -Message 'The success message is incorrect.'
Assert-Equal -Expected $title -Actual $created.listing.title -Message 'The returned title is incorrect.'
Assert-Equal -Expected 'Textbooks' -Actual $created.listing.category -Message 'The returned category is incorrect.'
Assert-Equal -Expected 'Like New' -Actual $created.listing.condition -Message 'The returned condition is incorrect.'
Assert-Equal -Expected '40.00' -Actual $created.listing.price -Message 'The returned price is incorrect.'
Assert-Equal -Expected $relatedCourse -Actual $created.listing.related_course -Message 'The returned course is incorrect.'
Assert-Equal -Expected $meetingLocation -Actual $created.listing.meeting_location -Message 'The returned meeting location is incorrect.'
Assert-Equal -Expected 'active' -Actual $created.listing.status -Message 'A new listing must be active.'
Assert-True -Condition ($null -eq $created.listing.image_url) -Message 'Image URL must remain empty until the image story is implemented.'
Assert-True -Condition ([int64] $created.listing.listing_id -gt 0) -Message 'The API did not return a valid listing ID.'

$persisted = Invoke-JsonRequest -CurlArguments @(
    "$getListingUrl`?listing_id=$($created.listing.listing_id)"
) -ExpectedStatus 200
Assert-True -Condition ([bool] $persisted.success) -Message 'The persisted listing could not be loaded.'
Assert-Equal -Expected $created.listing.listing_id -Actual $persisted.listing.listing_id -Message 'The persisted listing ID is incorrect.'
Assert-Equal -Expected $title -Actual $persisted.listing.title -Message 'The persisted listing title is incorrect.'
Assert-Equal -Expected '40.00' -Actual $persisted.listing.price -Message 'The persisted listing price is incorrect.'
Assert-Equal -Expected 'active' -Actual $persisted.listing.status -Message 'The persisted listing status is incorrect.'
Write-Host 'PASS' -ForegroundColor Green

Write-Host 'Test 2: reject missing required fields'
$missing = Post-Json -Url $createUrl -Body '{}' -ExpectedStatus 422
Assert-True -Condition (-not [bool] $missing.success) -Message 'An empty listing was accepted.'
foreach ($field in @('title', 'category', 'condition', 'price', 'meeting_location', 'description')) {
    Assert-True -Condition ($null -ne $missing.errors.$field) -Message "Missing-field response did not identify $field."
}
Assert-True -Condition ($null -eq $missing.errors.related_course) -Message 'The optional related course was treated as required.'
Write-Host 'PASS' -ForegroundColor Green

Write-Host 'Test 3: reject invalid listing values'
$invalidBody = @{
    title = 'Invalid Listing Test'
    category = 'Vehicles'
    condition = 'Perfect'
    price = '40.999'
    related_course = ''
    meeting_location = 'Off Campus'
    description = 'This request should be rejected.'
} | ConvertTo-Json -Compress

$invalid = Post-Json -Url $createUrl -Body $invalidBody -ExpectedStatus 422
foreach ($field in @('category', 'condition', 'price', 'meeting_location')) {
    Assert-True -Condition ($null -ne $invalid.errors.$field) -Message "Invalid-value response did not identify $field."
}
Write-Host 'PASS' -ForegroundColor Green

Write-Host 'Test 4: reject malformed JSON'
$malformed = Post-Json -Url $createUrl -Body '{"title":' -ExpectedStatus 400
Assert-Equal -Expected 'The request body must contain valid JSON.' -Actual $malformed.error -Message 'Malformed-JSON error is incorrect.'
Write-Host 'PASS' -ForegroundColor Green

Write-Host 'Test 5: reject unsupported request methods'
$wrongMethod = Invoke-JsonRequest -CurlArguments @($createUrl) -ExpectedStatus 405
Assert-Equal -Expected 'Method not allowed.' -Actual $wrongMethod.error -Message 'Method error is incorrect.'
Write-Host 'PASS' -ForegroundColor Green

Write-Host 'All create-listing backend tests passed.' -ForegroundColor Green
