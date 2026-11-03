[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https?://')]
    [string] $ProjectBaseUrl,
    [PSCredential] $Credential,
    [string] $Community = 'Karavan',
    [string] $LocationLabel = 'Capen Hall Main Entrance',
    [double] $ExpectedLatitude = 43.000822,
    [double] $ExpectedLongitude = -78.789203
)

# QA only: uploads one photo and creates two owned test listings, deleted in finally.
# The uploaded QA photo is retained (there is no photo-delete API).
# Requires migration 011, an existing student account, and two community locations.
$ErrorActionPreference = 'Stop'
$baseUrl = $ProjectBaseUrl.TrimEnd('/')
if ($null -eq $Credential) {
    $Credential = Get-Credential -Message 'Enter the dedicated student test account email and password'
}
if ($null -eq $Credential) { throw 'Test credentials are required.' }
$cookieFile = [IO.Path]::GetTempFileName()
$createdIds = New-Object 'System.Collections.Generic.List[int]'

function Assert-That([bool] $Condition, [string] $Message) {
    if (-not $Condition) { throw $Message }
}

function Request-Json {
    param(
        [string] $Path,
        [int] $ExpectedStatus = 200,
        [string] $Method = 'GET',
        $Body = $null,
        [switch] $Anonymous,
        [string] $Image = ''
    )
    $responseFile = [IO.Path]::GetTempFileName()
    $bodyFile = $null
    try {
        $arguments = @('-sS', '--connect-timeout', '15', '--max-time', '60', '-X', $Method)
        if (-not $Anonymous) { $arguments += @('-b', $cookieFile, '-c', $cookieFile) }
        if ($null -ne $Body) {
            $bodyFile = [IO.Path]::GetTempFileName()
            [IO.File]::WriteAllText($bodyFile, ($Body | ConvertTo-Json -Compress -Depth 10), (New-Object Text.UTF8Encoding($false)))
            $arguments += @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
        }
        if ($Image -ne '') { $arguments += @('-F', "image=@$Image") }
        $status = (& curl.exe @arguments "$baseUrl/$Path" -o $responseFile -w '%{http_code}') -join ''
        if ($LASTEXITCODE -ne 0) { throw "curl.exe failed for $Path" }
        $text = [IO.File]::ReadAllText($responseFile, [Text.Encoding]::UTF8)
        if ([int] $status -ne $ExpectedStatus) {
            throw "$Path expected HTTP $ExpectedStatus, received $status. $text"
        }
        return ($text | ConvertFrom-Json)
    } finally {
        Remove-Item -LiteralPath $responseFile -Force
        if ($null -ne $bodyFile) { Remove-Item -LiteralPath $bodyFile -Force }
    }
}

function Assert-Location($Listing, $Location) {
    Assert-That ([int] $Listing.meeting_location_id -eq [int] $Location.location_id) 'The saved location ID is incorrect.'
    Assert-That ($null -ne $Listing.meeting_location_details) 'The selected location has no map data.'
    Assert-That ([int] $Listing.meeting_location_details.location_id -eq [int] $Location.location_id) 'The map points to another location.'
    Assert-That ([string] $Listing.meeting_location_details.label -ceq [string] $Location.label) 'The map label is incorrect.'
    foreach ($key in @('lat', 'lng')) {
        $number = $Listing.meeting_location_details.$key
        Assert-That (($number -is [double]) -or ($number -is [decimal]) -or ($number -is [int]) -or ($number -is [long])) "The $key coordinate must be a JSON number."
        $limit = 180
        if ($key -eq 'lat') { $limit = 90 }
        Assert-That ((-not [double]::IsNaN([double] $number)) -and (-not [double]::IsInfinity([double] $number)) -and [Math]::Abs([double] $number) -le $limit) "The $key coordinate is outside its valid range."
    }
}

try {
    $login = Request-Json -Path 'login.php' -Method POST -Body @{
        email = $Credential.UserName
        password = $Credential.GetNetworkCredential().Password
    }
    Assert-That ([bool] $login.success) 'Test account login failed.'
    $locations = @( (Request-Json -Path ('api/get_meeting_locations.php?community=' + [Uri]::EscapeDataString($Community))).locations )
    $selected = @($locations | Where-Object { $_.label -ceq $LocationLabel })
    Assert-That ($selected.Count -eq 1) 'The expected location label must identify exactly one location in this community.'
    $first = $selected[0]
    $other = @($locations | Where-Object { $_.location_id -ne $first.location_id })
    Assert-That ($other.Count -gt 0) 'Prepare a second approved location in the same community before testing.'
    $imagePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\frontend\src\assets\hero.png'))
    $uploaded = Request-Json -Path 'listing/api/upload_image.php' -Method POST -Image $imagePath -ExpectedStatus 201
    Assert-That ([bool] $uploaded.success) 'Test photo upload failed.'

    Write-Host 'Test 1: save and independently reload the selected meeting location'
    $input = @{
        title = 'Meeting Map API Test ' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        category = 'Textbooks'; condition = 'Good'; price = '25.00'
        community = $Community; meeting_location_id = [int] $first.location_id
        meeting_location = 'Forged client label must not be stored'
        description = 'Temporary backend map test listing.'; image_url = $uploaded.image_url
    }
    $created = Request-Json -Path 'listing/api/create_listing.php' -Method POST -Body $input -ExpectedStatus 201
    Assert-That ([bool] $created.success) 'Create listing failed.'
    $id = [int] $created.listing.listing_id
    $createdIds.Add($id)
    Assert-Location $created.listing $first
    Assert-That ($created.listing.meeting_location -ceq $first.label) 'The server trusted a client-supplied label.'
    $saved = (Request-Json -Path "listing/api/get_listing.php?listing_id=$id").listing
    Assert-Location $saved $first
    $item = (Request-Json -Path "api/get_item_details.php?listing_id=$id").listing
    Assert-Location $item $first
    Assert-That ([Math]::Abs([double] $item.meeting_location_details.lat - $ExpectedLatitude) -lt 0.0000001) 'Latitude does not match the known database fixture.'
    Assert-That ([Math]::Abs([double] $item.meeting_location_details.lng - $ExpectedLongitude) -lt 0.0000001) 'Longitude does not match the known database fixture.'
    Assert-That ($item.name -ceq $input.title -and $item.price -eq '25.00' -and $item.description -ceq $input.description -and $item.community -ceq $Community) 'Existing listing details changed.'
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 2: a second listing returns its own selected location'
    $input.meeting_location_id = [int] $other[0].location_id
    $created = Request-Json -Path 'listing/api/create_listing.php' -Method POST -Body $input -ExpectedStatus 201
    $secondId = [int] $created.listing.listing_id
    $createdIds.Add($secondId)
    $item = (Request-Json -Path "api/get_item_details.php?listing_id=$secondId").listing
    Assert-Location $item $other[0]
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 3: reject invalid location selections'
    $input.meeting_location_id = 2147483647
    $invalid = Request-Json -Path 'listing/api/create_listing.php' -Method POST -Body $input -ExpectedStatus 422
    Assert-That (-not [bool] $invalid.success -and $null -ne $invalid.errors.meeting_location_id) 'Invalid location was accepted.'
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 4: require authentication and preserve HTTP errors'
    $denied = Request-Json -Path "api/get_item_details.php?listing_id=$id" -Anonymous -ExpectedStatus 401
    Assert-That ($null -eq $denied.listing) 'Unauthenticated response leaked listing data.'
    $null = Request-Json -Path 'api/get_item_details.php?listing_id=abc' -ExpectedStatus 400
    $null = Request-Json -Path 'api/get_item_details.php?listing_id=2147483647' -ExpectedStatus 404
    $null = Request-Json -Path "api/get_item_details.php?listing_id=$id" -Method POST -ExpectedStatus 405
    Write-Host 'PASS' -ForegroundColor Green

    Write-Host 'Test 5: changing legacy location text cannot retain the old map pin'
    $edit = @{
        action = 'save_changes'; listing_id = $id; name = $input.title; price = '25.00'
        category = 'Textbooks'; condition = 'Good'; description = $input.description
        image_url = $uploaded.image_url; meeting_location = 'Unmatched QA location ' + [guid]::NewGuid().ToString('N')
    }
    $null = Request-Json -Path 'listing/api/update_listing.php' -Method POST -Body $edit
    $item = (Request-Json -Path "api/get_item_details.php?listing_id=$id").listing
    Assert-That ($item.meeting_location -ceq $edit.meeting_location) 'Updated text was not saved.'
    Assert-That ($null -eq $item.meeting_location_id -and $null -eq $item.meeting_location_details) 'The old map pin was retained.'
    Write-Host 'PASS' -ForegroundColor Green
    Write-Host 'All meeting-location backend API tests passed.' -ForegroundColor Green
} finally {
    $cleanupFailed = $false
    foreach ($id in $createdIds) {
        try {
            $null = Request-Json -Path 'listing/api/update_listing.php' -Method POST -Body @{action = 'delete'; listing_id = $id}
        } catch {
            $cleanupFailed = $true
            Write-Warning "Could not remove temporary listing $id. Remove it from Manage Listings."
        }
    }
    Remove-Item -LiteralPath $cookieFile -Force
    if ($null -ne $uploaded) {
        if (-not $cleanupFailed) { Write-Host 'Temporary listings cleaned up.' }
        Write-Host 'One uploaded QA photo remains on the server (no photo-delete API).'
    }
}
