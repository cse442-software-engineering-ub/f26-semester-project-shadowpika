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

function Invoke-SearchRequest {
    param(
        [Parameter(Mandatory = $true)] [string] $Url,
        [Parameter(Mandatory = $true)] [int] $ExpectedStatus
    )

    $temporaryResponse = [IO.Path]::GetTempFileName()
    try {
        $statusText = (& curl.exe -sS $Url -o $temporaryResponse -w '%{http_code}') -join ''
        if ($LASTEXITCODE -ne 0) {
            throw "curl.exe failed with exit code $LASTEXITCODE."
        }

        $status = [int] $statusText
        $body = [IO.File]::ReadAllText($temporaryResponse, [Text.Encoding]::UTF8)
        if ($status -ne $ExpectedStatus) {
            throw "Unexpected HTTP status. Expected '$ExpectedStatus' but received '$status'. Body: $body"
        }

        try {
            return $body | ConvertFrom-Json
        } catch {
            throw "The endpoint did not return valid JSON. Body: $body"
        }
    } finally {
        if (Test-Path -LiteralPath $temporaryResponse) {
            Remove-Item -LiteralPath $temporaryResponse -Force
        }
    }
}

function Encode-QueryValue {
    param([Parameter(Mandatory = $true)] [string] $Value)
    return [Uri]::EscapeDataString($Value)
}

function Assert-OnlyCategories {
    param(
        [Parameter(Mandatory = $true)] $Results,
        [Parameter(Mandatory = $true)] [string[]] $AllowedCategories
    )

    foreach ($listing in @($Results)) {
        Assert-True -Condition ($AllowedCategories -contains [string] $listing.category) `
            -Message "Listing '$($listing.name)' returned unexpected category '$($listing.category)'."
    }
}

$baseUrl = $ProjectBaseUrl.TrimEnd('/')
$endpoint = "$baseUrl/api/search_listings.php"

Write-Host 'Test 1: no filters returns all active listings'
$allActive = Invoke-SearchRequest -Url $endpoint -ExpectedStatus 200
Assert-True -Condition ([bool] $allActive.success) -Message 'The unfiltered request was not successful.'
Assert-True -Condition (@($allActive.results).Count -gt 0) -Message 'Expected at least one active listing.'
Assert-True -Condition (-not (@($allActive.results.listing_id) -contains 91004)) -Message 'A sold listing was returned.'
Write-Host 'PASS'

Write-Host 'Test 2: one category returns only exact active matches'
$textbooks = Invoke-SearchRequest -Url "${endpoint}?categories=$(Encode-QueryValue 'Textbooks')" -ExpectedStatus 200
Assert-True -Condition ([bool] $textbooks.success) -Message 'The Textbooks request was not successful.'
Assert-True -Condition (@($textbooks.results).Count -gt 0) -Message 'Expected at least one Textbooks listing.'
Assert-OnlyCategories -Results $textbooks.results -AllowedCategories @('Textbooks')
Assert-True -Condition (-not (@($textbooks.results.listing_id) -contains 91004)) -Message 'The sold Calculus Notes listing was returned.'
Write-Host 'PASS'

Write-Host 'Test 3: multiple categories use OR and remove duplicates'
$multipleValue = Encode-QueryValue 'Textbooks, Dorm Living, Textbooks'
$multiple = Invoke-SearchRequest -Url "${endpoint}?categories=$multipleValue" -ExpectedStatus 200
Assert-True -Condition ([bool] $multiple.success) -Message 'The multi-category request was not successful.'
Assert-OnlyCategories -Results $multiple.results -AllowedCategories @('Textbooks', 'Dorm Living')
Assert-True -Condition (@($multiple.results.category) -contains 'Textbooks') -Message 'No Textbooks listing was returned.'
Assert-True -Condition (@($multiple.results.category) -contains 'Dorm Living') -Message 'No Dorm Living listing was returned.'
Write-Host 'PASS'

Write-Host 'Test 4: keyword and categories use AND'
$intersection = Invoke-SearchRequest -Url "${endpoint}?q=Calculus&categories=$(Encode-QueryValue 'Textbooks')" -ExpectedStatus 200
Assert-True -Condition ([bool] $intersection.success) -Message 'The combined request was not successful.'
Assert-True -Condition (@($intersection.results).Count -gt 0) -Message 'Expected active Calculus Textbooks listings.'
Assert-OnlyCategories -Results $intersection.results -AllowedCategories @('Textbooks')
foreach ($listing in @($intersection.results)) {
    Assert-True -Condition ([string] $listing.name -like 'Calculus*') -Message "Unexpected keyword match '$($listing.name)'."
}
Assert-True -Condition (-not (@($intersection.results.listing_id) -contains 91004)) -Message 'A sold listing was returned by the combined filter.'
Write-Host 'PASS'

Write-Host 'Test 5: a valid category and unmatched query return an empty array'
$empty = Invoke-SearchRequest -Url "${endpoint}?q=DefinitelyNoListingExists&categories=$(Encode-QueryValue 'Textbooks')" -ExpectedStatus 200
Assert-True -Condition ([bool] $empty.success) -Message 'The empty-result request was not successful.'
Assert-Equal -Expected 0 -Actual @($empty.results).Count -Message 'The valid no-match request should return no listings.'
Write-Host 'PASS'

Write-Host 'Test 6: unsupported categories are rejected'
$invalid = Invoke-SearchRequest -Url "${endpoint}?categories=$(Encode-QueryValue 'Vehicles')" -ExpectedStatus 400
Assert-True -Condition (-not [bool] $invalid.success) -Message 'The invalid category request unexpectedly succeeded.'
Assert-True -Condition ([string] $invalid.error -match 'Unsupported category') -Message 'The invalid category error was not user-safe.'
Write-Host 'PASS'

Write-Host 'Test 7: existing query validation is preserved'
$keyword = Invoke-SearchRequest -Url "${endpoint}?q=Calculus" -ExpectedStatus 200
Assert-True -Condition ([bool] $keyword.success) -Message 'The existing keyword search failed.'
Assert-True -Condition (@($keyword.results).Count -gt 0) -Message 'The keyword search returned no active Calculus listings.'

$emoji = Invoke-SearchRequest -Url "${endpoint}?q=$(Encode-QueryValue ([char]::ConvertFromUtf32(0x1F4DA)))" -ExpectedStatus 400
Assert-True -Condition (-not [bool] $emoji.success) -Message 'An emoji query unexpectedly succeeded.'

$longQuery = 'a' * 51
$tooLong = Invoke-SearchRequest -Url "${endpoint}?q=$longQuery" -ExpectedStatus 400
Assert-True -Condition (-not [bool] $tooLong.success) -Message 'A query over 50 characters unexpectedly succeeded.'
Write-Host 'PASS'

Write-Host 'All category filtering API tests passed.'
