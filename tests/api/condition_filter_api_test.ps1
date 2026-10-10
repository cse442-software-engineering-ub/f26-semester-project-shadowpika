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
        [Parameter(Mandatory = $true)] [int] $ExpectedStatus,
        [ValidateSet('GET', 'POST')] [string] $Method = 'GET'
    )

    $temporaryResponse = [IO.Path]::GetTempFileName()
    try {
        $statusText = (& curl.exe -sS -X $Method $Url -o $temporaryResponse -w '%{http_code}') -join ''
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

function Assert-OnlyConditions {
    param(
        [Parameter(Mandatory = $true)] $Results,
        [Parameter(Mandatory = $true)] [string[]] $AllowedConditions
    )

    foreach ($listing in @($Results)) {
        Assert-True -Condition ($AllowedConditions -contains [string] $listing.condition) `
            -Message "Listing '$($listing.name)' returned unexpected condition '$($listing.condition)'."
    }
}

$baseUrl = $ProjectBaseUrl.TrimEnd('/')
$endpoint = "$baseUrl/api/search_listings.php"

Write-Host 'Test 1: no condition filter preserves active listings and returns condition'
$allActive = Invoke-SearchRequest -Url $endpoint -ExpectedStatus 200
Assert-True -Condition ([bool] $allActive.success) -Message 'The unfiltered request was not successful.'
Assert-True -Condition (@($allActive.results).Count -gt 0) -Message 'Expected at least one active listing.'
foreach ($listing in @($allActive.results)) {
    Assert-True -Condition ($listing.PSObject.Properties.Name -contains 'condition') `
        -Message "Listing '$($listing.name)' did not include condition."
}
Assert-True -Condition (-not (@($allActive.results.listing_id) -contains 91004)) -Message 'A sold listing was returned.'
Write-Host 'PASS'

Write-Host 'Test 2: one condition returns only exact active matches'
$good = Invoke-SearchRequest -Url "${endpoint}?conditions=$(Encode-QueryValue 'Good')" -ExpectedStatus 200
Assert-True -Condition ([bool] $good.success) -Message 'The Good request was not successful.'
Assert-True -Condition (@($good.results).Count -gt 0) -Message 'Expected at least one Good listing.'
Assert-OnlyConditions -Results $good.results -AllowedConditions @('Good')
Assert-True -Condition (-not (@($good.results.listing_id) -contains 91004)) -Message 'The sold listing was returned.'
Write-Host 'PASS'

Write-Host 'Test 3: multiple conditions use OR and remove duplicate selections'
$multipleValue = Encode-QueryValue 'Like New,Acceptable,Like New'
$multiple = Invoke-SearchRequest -Url "${endpoint}?conditions=$multipleValue" -ExpectedStatus 200
Assert-True -Condition ([bool] $multiple.success) -Message 'The multi-condition request was not successful.'
Assert-OnlyConditions -Results $multiple.results -AllowedConditions @('Like New', 'Acceptable')
Assert-True -Condition (@($multiple.results.condition) -contains 'Like New') -Message 'No Like New listing was returned.'
Assert-True -Condition (@($multiple.results.condition) -contains 'Acceptable') -Message 'No Acceptable listing was returned.'
$multipleIds = @($multiple.results | ForEach-Object { [int] $_.listing_id })
$uniqueMultipleIds = @($multipleIds | Select-Object -Unique)
Assert-Equal -Expected $multipleIds.Count -Actual $uniqueMultipleIds.Count -Message 'A duplicate listing row was returned.'
Write-Host 'PASS'

Write-Host 'Test 4: keyword and conditions use AND'
$keywordCondition = Invoke-SearchRequest `
    -Url "${endpoint}?q=Calculus&conditions=$(Encode-QueryValue 'Good')" `
    -ExpectedStatus 200
Assert-True -Condition ([bool] $keywordCondition.success) -Message 'The keyword-condition request was not successful.'
Assert-True -Condition (@($keywordCondition.results).Count -gt 0) -Message 'Expected an active Good Calculus listing.'
Assert-OnlyConditions -Results $keywordCondition.results -AllowedConditions @('Good')
foreach ($listing in @($keywordCondition.results)) {
    Assert-True -Condition ([string] $listing.name -like 'Calculus*') `
        -Message "Unexpected keyword match '$($listing.name)'."
}
Write-Host 'PASS'

Write-Host 'Test 5: category and conditions use AND'
$categoryCondition = Invoke-SearchRequest `
    -Url "${endpoint}?categories=$(Encode-QueryValue 'Textbooks')&conditions=$(Encode-QueryValue 'Good')" `
    -ExpectedStatus 200
Assert-True -Condition ([bool] $categoryCondition.success) -Message 'The category-condition request was not successful.'
Assert-True -Condition (@($categoryCondition.results).Count -gt 0) -Message 'Expected active Good Textbooks listings.'
Assert-OnlyConditions -Results $categoryCondition.results -AllowedConditions @('Good')
foreach ($listing in @($categoryCondition.results)) {
    Assert-Equal -Expected 'Textbooks' -Actual ([string] $listing.category) `
        -Message "Listing '$($listing.name)' returned an unexpected category."
}
Write-Host 'PASS'

Write-Host 'Test 6: a valid condition and unmatched query return an empty array'
$empty = Invoke-SearchRequest `
    -Url "${endpoint}?q=DefinitelyNoListingExists&conditions=$(Encode-QueryValue 'New')" `
    -ExpectedStatus 200
Assert-True -Condition ([bool] $empty.success) -Message 'The empty-result request was not successful.'
Assert-Equal -Expected 0 -Actual @($empty.results).Count -Message 'The valid no-match request should return no listings.'
Write-Host 'PASS'

Write-Host 'Test 7: unsupported and malformed conditions are rejected'
$invalid = Invoke-SearchRequest -Url "${endpoint}?conditions=$(Encode-QueryValue 'Used')" -ExpectedStatus 400
Assert-True -Condition (-not [bool] $invalid.success) -Message 'An unsupported condition unexpectedly succeeded.'
Assert-Equal -Expected 'One or more selected conditions are invalid.' -Actual ([string] $invalid.error) `
    -Message 'The unsupported-condition error is incorrect.'

$emptyList = Invoke-SearchRequest -Url "${endpoint}?conditions=" -ExpectedStatus 400
Assert-Equal -Expected 'One or more selected conditions are invalid.' -Actual ([string] $emptyList.error) `
    -Message 'The empty-condition error is incorrect.'

$emptyMember = Invoke-SearchRequest `
    -Url "${endpoint}?conditions=$(Encode-QueryValue 'Good,,Fair')" `
    -ExpectedStatus 400
Assert-Equal -Expected 'One or more selected conditions are invalid.' -Actual ([string] $emptyMember.error) `
    -Message 'The malformed-condition error is incorrect.'

$arrayInput = Invoke-SearchRequest -Url "${endpoint}?conditions%5B%5D=Good" -ExpectedStatus 400
Assert-Equal -Expected 'Conditions must be a comma-separated list.' -Actual ([string] $arrayInput.error) `
    -Message 'The condition-array error is incorrect.'
Write-Host 'PASS'

Write-Host 'Test 8: existing search behavior and request-method validation are preserved'
$keyword = Invoke-SearchRequest -Url "${endpoint}?q=Calculus" -ExpectedStatus 200
Assert-True -Condition ([bool] $keyword.success) -Message 'The existing keyword search failed.'
Assert-True -Condition (@($keyword.results).Count -gt 0) -Message 'The keyword search returned no active Calculus listings.'

$category = Invoke-SearchRequest -Url "${endpoint}?categories=$(Encode-QueryValue 'Textbooks')" -ExpectedStatus 200
Assert-True -Condition ([bool] $category.success) -Message 'The existing category filter failed.'
Assert-True -Condition (@($category.results).Count -gt 0) -Message 'The category filter returned no Textbooks listings.'

$wrongMethod = Invoke-SearchRequest -Url $endpoint -ExpectedStatus 405 -Method POST
Assert-Equal -Expected 'Method not allowed.' -Actual ([string] $wrongMethod.error) `
    -Message 'The unsupported-method error is incorrect.'
Write-Host 'PASS'

Write-Host 'All condition-filter API tests passed.'
