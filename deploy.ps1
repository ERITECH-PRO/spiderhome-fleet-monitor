param(
    [string]$Server = "root@srv892077.hstgr.cloud",
    [string]$RemotePath = "/opt/PROJET/heap-dashboard",
    [string]$AppName = "heap-dashboard",
    [int]$Port = 3006,
    [string]$IdentityFile = "",
    [switch]$SkipInstall,
    [switch]$SkipHealthCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$PublicDir = Join-Path $ProjectRoot "public"
$FilesToUpload = @(
    Join-Path $ProjectRoot "server.js"
    Join-Path $ProjectRoot "package.json"
    Join-Path $ProjectRoot "package-lock.json"
)

function Get-SshHostName {
    param([string]$ServerValue)

    if ($ServerValue -match '^(?<user>[^@]+)@(?<host>.+)$') {
        return $Matches.host
    }

    return $ServerValue
}

function Resolve-DefaultIdentityFile {
    $candidates = @(
        (Join-Path $HOME ".ssh\id_ed25519")
        (Join-Path $HOME ".ssh\deploy_key")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return ""
}

function Get-SshCommonArgs {
    param([string]$IdentityPath)

    $args = @(
        "-o", "PreferredAuthentications=publickey,password"
    )

    if ($IdentityPath) {
        $args += @(
            "-i", $IdentityPath,
            "-o", "IdentitiesOnly=yes"
        )
    }

    return $args
}

foreach ($requiredCommand in @("ssh", "scp")) {
    if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
        throw "La commande '$requiredCommand' est introuvable. Installe OpenSSH client sur Windows avant de lancer ce script."
    }
}

foreach ($requiredPath in $FilesToUpload + $PublicDir) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Fichier ou dossier introuvable: $requiredPath"
    }
}

if (-not $IdentityFile) {
    $IdentityFile = Resolve-DefaultIdentityFile
}

if ($IdentityFile -and -not (Test-Path -LiteralPath $IdentityFile)) {
    throw "Fichier de cle SSH introuvable: $IdentityFile"
}

$sshArgs = Get-SshCommonArgs -IdentityPath $IdentityFile
$scpArgs = @()
if ($IdentityFile) {
    $scpArgs += @("-i", $IdentityFile, "-o", "IdentitiesOnly=yes")
}

$ServerHost = Get-SshHostName -ServerValue $Server
try {
    [System.Net.Dns]::GetHostAddresses($ServerHost) | Out-Null
} catch {
    throw "Le nom d'hote '$ServerHost' ne se resout pas. Utilise une IP ou un FQDN, par exemple root@31.97.177.87 ou root@srv892077.hstgr.cloud."
}

Write-Host ""
Write-Host "==> Preparation du dossier distant $RemotePath" -ForegroundColor Cyan
& ssh @sshArgs $Server "mkdir -p '$RemotePath' '$RemotePath/public'"
if ($LASTEXITCODE -ne 0) {
    throw "Echec de la preparation du dossier distant."
}

Write-Host ""
Write-Host "==> Envoi des fichiers applicatifs" -ForegroundColor Cyan
& scp @scpArgs @FilesToUpload "${Server}:$RemotePath/"
if ($LASTEXITCODE -ne 0) {
    throw "Echec de l'envoi des fichiers principaux."
}

Write-Host ""
Write-Host "==> Envoi du dossier public" -ForegroundColor Cyan
& scp @scpArgs -r $PublicDir "${Server}:$RemotePath/"
if ($LASTEXITCODE -ne 0) {
    throw "Echec de l'envoi du dossier public."
}

$remoteSteps = @(
    "set -e"
    "cd '$RemotePath'"
)

if (-not $SkipInstall) {
    $remoteSteps += "npm install --omit=dev"
}

$remoteSteps += @(
    "if pm2 describe '$AppName' >/dev/null 2>&1; then"
    "  PORT='$Port' pm2 restart '$AppName' --update-env"
    "else"
    "  PORT='$Port' pm2 start server.js --name '$AppName'"
    "  pm2 save"
    "fi"
    "pm2 status '$AppName'"
)

if (-not $SkipHealthCheck) {
    $remoteSteps += @(
        "for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do"
        "  if curl -fsS 'http://127.0.0.1:$Port/health' >/dev/null 2>&1; then"
        "    curl -fsS 'http://127.0.0.1:$Port/health'"
        "    break"
        "  fi"
        '  if [ "$attempt" = "20" ]; then'
        "    echo 'Health check impossible sur le port $Port' >&2"
        "    exit 1"
        "  fi"
        "  sleep 1"
        "done"
    )
}

$remoteCommand = $remoteSteps -join "`n"

Write-Host ""
Write-Host "==> Installation et redemarrage sur le serveur" -ForegroundColor Cyan
& ssh @sshArgs $Server $remoteCommand
if ($LASTEXITCODE -ne 0) {
    throw "Le deploiement distant a echoue."
}

Write-Host ""
Write-Host "Deploiement termine avec succes." -ForegroundColor Green
