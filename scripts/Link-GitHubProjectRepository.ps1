param(
    [string]$Repo,
    [string]$Project = "Phytoritas's Portfolio",
    [string]$Owner = "@me",
    [switch]$RefreshProjectScope
)

. "$PSScriptRoot/GitHubProject.Common.ps1"

$ErrorActionPreference = "Stop"

Assert-Command gh
Assert-GhAuth

if ($RefreshProjectScope) {
    & gh auth refresh -h github.com -s read:project -s project | Out-Host
}
if (-not $Repo) {
    $Repo = Get-CurrentRepo
}

if ($Repo -notmatch '^(?<owner>[^/]+)/(?<name>[^/]+)$') {
    throw "Repo must be in the form <owner>/<repo>. Received: $Repo"
}

$repoOwner = $Matches.owner
$repoName = $Matches.name
$projectInfo = Get-ProjectInfo -Owner $Owner -Project $Project

$query = (
    'query($owner:String!, $name:String!) {' ,
    '  repository(owner:$owner, name:$name) {' ,
    '    id' ,
    '    nameWithOwner' ,
    '    projectsV2(first:100) {' ,
    '      nodes {' ,
    '        id' ,
    '        title' ,
    '      }' ,
    '    }' ,
    '  }' ,
    '}'
) -join "`n"

$queryArgs = @(
    "api", "graphql",
    "-f", "query=$query",
    "-f", "owner=$repoOwner",
    "-f", "name=$repoName"
)
$raw = & gh @queryArgs
if (-not $raw) {
    throw "Could not resolve repository metadata for $Repo."
}
if ($LASTEXITCODE -ne 0) {
    throw "gh api graphql failed while resolving repository metadata for $Repo."
}

$data = $raw | ConvertFrom-Json
$repository = $data.data.repository
if (-not $repository) {
    throw "Repository not found via GitHub GraphQL: $Repo"
}

$normalizedProjectTitle = $projectInfo.Title.TrimStart('@')
$existingLink = $repository.projectsV2.nodes |
    Where-Object { $_.id -eq $projectInfo.Id -or $_.title -eq $projectInfo.Title -or $_.title.TrimStart('@') -eq $normalizedProjectTitle } |
    Select-Object -First 1

if ($existingLink) {
    Write-Host "Repository already linked to project '$($existingLink.title)': $Repo"
    return
}

$mutation = (
    'mutation($project:ID!, $repository:ID!) {' ,
    '  linkProjectV2ToRepository(input:{projectId:$project, repositoryId:$repository}) {' ,
    '    clientMutationId' ,
    '  }' ,
    '}'
) -join "`n"

$mutationArgs = @(
    "api", "graphql",
    "-f", "query=$mutation",
    "-f", "project=$($projectInfo.Id)",
    "-f", "repository=$($repository.id)"
)
& gh @mutationArgs | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "gh api graphql failed while linking $Repo to project '$($projectInfo.Title)'."
}

Write-Host "Linked repository '$Repo' to project '$($projectInfo.Title)'"
