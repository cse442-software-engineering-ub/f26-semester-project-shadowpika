[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https?://')]
    [string] $ProjectBaseUrl
)

$ErrorActionPreference = 'Stop'
$InvariantCulture = [Globalization.CultureInfo]::InvariantCulture

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

function Listing-Price {
    param([Parameter(Mandatory = $true)] $Listing)
    return [decimal]::Parse([string] $Listing.price, $InvariantCulture)
}

function Assert-PricesWithin {
    param(
        [Parameter(Mandatory = $true)] $Results,
        [AllowNull()] [Nullable[decimal]] $Minimum,
        [AllowNull()] [Nullable[decimal]] $Maximum
    )

    foreach ($listing in @($Results)) {
        $price = Listing-Price -Listing $listing
        if ($null -ne $Minimum) {
            Assert-True -Condition ($price -ge $Minimum) `
                -Message "Listing '$($listing.name)' returned price '$price' below minimum '$Minimum'."
        }
        if ($null -ne $Maximum) {
            Assert-True -Condition ($price -le $Maximum) `
                -Message "Listing '$($listing.name)' returned price '$price' above maximum '$Maximum'."
        }
    }
}

function Assert-FixtureListing {
    param(
        [Parameter(Mandatory = $true)] $Results,
        [Parameter(Mandatory = $true)] [int] $ListingId,
        [Parameter(Mandatory = $true)] [string] $Name,
        [Parameter(Mandatory = $true)] [decimal] $Price,
        [Parameter(Mandatory = $true)] [string] $Condition,
        [Parameter(Mandatory = $true)] [string] $Category
    )

    $matches = @($Results | Where-Object { [int] $_.listing_id -eq $ListingId })
    Assert-Equal -Expected 1 -Actual $matches.Count `
        -Message "Required price-filter fixture '$ListingId' was missing or duplicated."

    $listing = $matches[0]
    Assert-Equal -Expected $Name -Actual ([string] $listing.name) `
        -Message "Fixture '$ListingId' has the wrong name."
    Assert-Equal -Expected $Price -Actual (Listing-Price -Listing $listing) `
        -Message "Fixture '$ListingId' has the wrong price."
    Assert-Equal -Expected $Condition -Actual ([string] $listing.condition) `
        -Message "Fixture '$ListingId' has the wrong condition."
    Assert-Equal -Expected $Category -Actual ([string] $listing.category) `
        -Message "Fixture '$ListingId' has the wrong category."
}

$baseUrl = $ProjectBaseUrl.TrimEnd('/')
$endpoint = "$baseUrl/api/search_listings.php"

Write-Host 'Test 1: no price filter preserves active listings and two-decimal prices'
$allActive = Invoke-SearchRequest -Url $endpoint -ExpectedStatus 200
Assert-True -Condition ([bool] $allActive.success) -Message 'The unfiltered request was not successful.'
Assert-True -Condition (@($allActive.results).Count -gt 0) -Message 'Expected at least one active listing.'
foreach ($listing in @($allActive.results)) {
    Assert-True -Condition ([string] $listing.price -match '^\d+\.\d{2}$') `
        -Message "Listing '$($listing.name)' did not return a two-decimal price."
}
Assert-True -Condition (-not (@($allActive.results.listing_id) -contains 91004)) -Message 'A sold listing was returned.'
Assert-FixtureListing -Results $allActive.results -ListingId 91001 -Name 'Calculus Textbook' `
    -Price 35.00 -Condition 'Good' -Category 'Textbooks'
Assert-FixtureListing -Results $allActive.results -ListingId 91002 -Name 'Calculus Workbook' `
    -Price 20.00 -Condition 'Like New' -Category 'Textbooks'
Assert-FixtureListing -Results $allActive.results -ListingId 91005 -Name 'Physical Chemistry' `
    -Price 60.00 -Condition 'Good' -Category 'Textbooks'
Assert-FixtureListing -Results $allActive.results -ListingId 91006 -Name 'Genetics: A Conceptual Approach' `
    -Price 45.00 -Condition 'Like New' -Category 'Textbooks'
Assert-FixtureListing -Results $allActive.results -ListingId 91007 -Name 'Campbell Biology' `
    -Price 55.00 -Condition 'Acceptable' -Category 'Textbooks'
Assert-FixtureListing -Results $allActive.results -ListingId 91008 -Name 'Organic Chemistry Textbook' `
    -Price 50.00 -Condition 'Good' -Category 'Textbooks'
Assert-FixtureListing -Results $allActive.results -ListingId 91009 -Name 'Introduction to Algorithms' `
    -Price 40.00 -Condition 'Like New' -Category 'Textbooks'
Assert-FixtureListing -Results $allActive.results -ListingId 91010 -Name 'Dorm Fridge' `
    -Price 80.00 -Condition 'Good' -Category 'Dorm Living'
Write-Host 'PASS'

Write-Host 'Test 2: minimum and maximum are inclusive'
$bounded = Invoke-SearchRequest -Url "${endpoint}?min_price=35.00&max_price=50.00" -ExpectedStatus 200
Assert-True -Condition ([bool] $bounded.success) -Message 'The bounded request was not successful.'
Assert-True -Condition (@($bounded.results).Count -gt 0) -Message 'Expected listings inside the bounded range.'
Assert-PricesWithin -Results $bounded.results -Minimum 35.00 -Maximum 50.00
Assert-True -Condition (@($bounded.results.listing_id) -contains 91001) -Message 'The listing at the exact minimum was excluded.'
Assert-True -Condition (@($bounded.results.listing_id) -contains 91008) -Message 'The listing at the exact maximum was excluded.'
Assert-True -Condition (-not (@($bounded.results.listing_id) -contains 91002)) -Message 'A listing below the minimum was returned.'
Assert-True -Condition (-not (@($bounded.results.listing_id) -contains 91007)) -Message 'A listing above the maximum was returned.'
Write-Host 'PASS'

Write-Host 'Test 3: minimum-only filtering is inclusive'
$minimumOnly = Invoke-SearchRequest -Url "${endpoint}?min_price=50.00" -ExpectedStatus 200
Assert-True -Condition (@($minimumOnly.results).Count -gt 0) -Message 'Expected listings at or above the minimum.'
Assert-PricesWithin -Results $minimumOnly.results -Minimum 50.00 -Maximum $null
Assert-True -Condition (@($minimumOnly.results.listing_id) -contains 91008) -Message 'The listing at the exact minimum was excluded.'
Assert-True -Condition (-not (@($minimumOnly.results.listing_id) -contains 91009)) -Message 'A listing below the minimum was returned.'
Write-Host 'PASS'

Write-Host 'Test 4: maximum-only filtering is inclusive and active-only'
$maximumOnly = Invoke-SearchRequest -Url "${endpoint}?max_price=20.00" -ExpectedStatus 200
Assert-True -Condition (@($maximumOnly.results).Count -gt 0) -Message 'Expected listings at or below the maximum.'
Assert-PricesWithin -Results $maximumOnly.results -Minimum $null -Maximum 20.00
Assert-True -Condition (@($maximumOnly.results.listing_id) -contains 91002) -Message 'The listing at the exact maximum was excluded.'
Assert-True -Condition (-not (@($maximumOnly.results.listing_id) -contains 91004)) -Message 'The sold listing was returned.'
Write-Host 'PASS'

Write-Host 'Test 5: keyword and price bounds use AND'
$keywordPrice = Invoke-SearchRequest -Url "${endpoint}?q=Calculus&min_price=25.00&max_price=40.00" -ExpectedStatus 200
Assert-True -Condition (@($keywordPrice.results).Count -gt 0) -Message 'Expected a Calculus listing inside the range.'
Assert-PricesWithin -Results $keywordPrice.results -Minimum 25.00 -Maximum 40.00
foreach ($listing in @($keywordPrice.results)) {
    Assert-True -Condition ([string] $listing.name -like 'Calculus*') `
        -Message "Unexpected keyword match '$($listing.name)'."
}
Assert-True -Condition (-not (@($keywordPrice.results.listing_id) -contains 91002)) -Message 'The below-range Calculus listing was returned.'
Write-Host 'PASS'

Write-Host 'Test 6: category, condition, and price bounds use AND'
$combinedUrl = "${endpoint}?categories=$(Encode-QueryValue 'Textbooks')&conditions=$(Encode-QueryValue 'Like New')&min_price=40.00&max_price=45.00"
$combined = Invoke-SearchRequest -Url $combinedUrl -ExpectedStatus 200
Assert-True -Condition (@($combined.results).Count -gt 0) -Message 'Expected matching combined-filter listings.'
Assert-PricesWithin -Results $combined.results -Minimum 40.00 -Maximum 45.00
foreach ($listing in @($combined.results)) {
    Assert-Equal -Expected 'Textbooks' -Actual ([string] $listing.category) `
        -Message "Listing '$($listing.name)' returned an unexpected category."
    Assert-Equal -Expected 'Like New' -Actual ([string] $listing.condition) `
        -Message "Listing '$($listing.name)' returned an unexpected condition."
}
Write-Host 'PASS'

Write-Host 'Test 7: a valid range and unmatched query return an empty array'
$empty = Invoke-SearchRequest -Url "${endpoint}?q=DefinitelyNoListingExists&min_price=0.00&max_price=9999.99" -ExpectedStatus 200
Assert-True -Condition ([bool] $empty.success) -Message 'The empty-result request was not successful.'
Assert-Equal -Expected 0 -Actual @($empty.results).Count -Message 'The valid no-match request should return no listings.'
Write-Host 'PASS'

Write-Host 'Test 8: empty bounds are treated as not applied'
$emptyBounds = Invoke-SearchRequest -Url "${endpoint}?min_price=&max_price=" -ExpectedStatus 200
Assert-True -Condition ([bool] $emptyBounds.success) -Message 'The empty-bound request was not successful.'
Assert-Equal -Expected @($allActive.results).Count -Actual @($emptyBounds.results).Count `
    -Message 'Empty price bounds changed the result count.'
Write-Host 'PASS'

Write-Host 'Test 9: invalid price input is rejected'
$inverted = Invoke-SearchRequest -Url "${endpoint}?min_price=75.00&max_price=10.00" -ExpectedStatus 400
Assert-Equal -Expected 'Minimum price cannot be greater than maximum price.' -Actual ([string] $inverted.error) `
    -Message 'The inverted-range error is incorrect.'

$invalidCases = @(
    @{ Query = 'min_price=-1'; Expected = 'Minimum price must be between 0.00 and 9,999.99 with no more than two decimal places.' },
    @{ Query = 'min_price=abc'; Expected = 'Minimum price must be between 0.00 and 9,999.99 with no more than two decimal places.' },
    @{ Query = 'max_price=10.001'; Expected = 'Maximum price must be between 0.00 and 9,999.99 with no more than two decimal places.' },
    @{ Query = 'max_price=10000'; Expected = 'Maximum price must be between 0.00 and 9,999.99 with no more than two decimal places.' },
    @{ Query = 'min_price=1e2'; Expected = 'Minimum price must be between 0.00 and 9,999.99 with no more than two decimal places.' }
)
foreach ($case in $invalidCases) {
    $response = Invoke-SearchRequest -Url "${endpoint}?$($case.Query)" -ExpectedStatus 400
    Assert-Equal -Expected $case.Expected -Actual ([string] $response.error) `
        -Message "The error for '$($case.Query)' is incorrect."
}

$minimumArray = Invoke-SearchRequest -Url "${endpoint}?min_price%5B%5D=10" -ExpectedStatus 400
Assert-Equal -Expected 'Minimum price must be a single decimal value.' -Actual ([string] $minimumArray.error) `
    -Message 'The minimum-price array error is incorrect.'

$maximumArray = Invoke-SearchRequest -Url "${endpoint}?max_price%5B%5D=10" -ExpectedStatus 400
Assert-Equal -Expected 'Maximum price must be a single decimal value.' -Actual ([string] $maximumArray.error) `
    -Message 'The maximum-price array error is incorrect.'
Write-Host 'PASS'

Write-Host 'Test 10: existing filters and request-method validation are preserved'
$category = Invoke-SearchRequest -Url "${endpoint}?categories=$(Encode-QueryValue 'Textbooks')" -ExpectedStatus 200
Assert-True -Condition (@($category.results).Count -gt 0) -Message 'The existing category filter failed.'

$condition = Invoke-SearchRequest -Url "${endpoint}?conditions=$(Encode-QueryValue 'Good')" -ExpectedStatus 200
Assert-True -Condition (@($condition.results).Count -gt 0) -Message 'The existing condition filter failed.'

$wrongMethod = Invoke-SearchRequest -Url $endpoint -ExpectedStatus 405 -Method POST
Assert-Equal -Expected 'Method not allowed.' -Actual ([string] $wrongMethod.error) `
    -Message 'The unsupported-method error is incorrect.'
Write-Host 'PASS'

Write-Host 'All price-filter API tests passed.'
