[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https?://')]
    [string] $ProjectBaseUrl
)

$ErrorActionPreference = 'Stop'

function Assert-True {
    param(
        [Parameter(Mandatory = $true)] [bool] $Condition,
        [Parameter(Mandatory = $true)] [string] $Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Search-Course {
    param([Parameter(Mandatory = $true)] [string] $Course)
    $encoded = [Uri]::EscapeDataString($Course)
    return Invoke-RestMethod -Method Get -Uri "$($ProjectBaseUrl.TrimEnd('/'))/api/search_listings.php?q=$encoded"
}

Write-Host 'Test 1: an active listing can be found by its related course number'
$math = Search-Course -Course 'MTH 141'
Assert-True -Condition ([bool] $math.success) -Message 'The course search was not successful.'
Assert-True -Condition (@($math.results.listing_id) -contains 91001) `
    -Message 'MTH 141 did not return the active Calculus Textbook fixture.'
Write-Host 'PASS'

Write-Host 'Test 2: sold listings stay hidden when their related course matches'
Assert-True -Condition (-not (@($math.results.listing_id) -contains 91004)) `
    -Message 'The sold Calculus Notes fixture was returned by related-course search.'
Write-Host 'PASS'

Write-Host 'Test 3: another course returns its expected active listing'
$computerScience = Search-Course -Course 'CSE 331'
Assert-True -Condition (@($computerScience.results.listing_id) -contains 91009) `
    -Message 'CSE 331 did not return the Introduction to Algorithms fixture.'
Write-Host 'PASS'

Write-Host 'All related-course search API tests passed.'
