param(
    [string]$Server = "root@srv892077.hstgr.cloud",
    [string]$PublicKeyPath = "",
    [string]$PrivateKeyPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-DefaultPublicKeyPath {
    $candidates = @(
        (Join-Path $HOME ".ssh\id_ed25519.pub")
        (Join-Path $HOME ".ssh\deploy_key.pub")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return ""
}

function Resolve-MatchingPrivateKeyPath {
    param([string]$PublicPath)

    if (-not $PublicPath) {
        return ""
    }

    if ($PublicPath.EndsWith(".pub")) {
        $privatePath = $PublicPath.Substring(0, $PublicPath.Length - 4)
        if (Test-Path -LiteralPath $privatePath) {
            return $privatePath
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

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "La commande 'ssh' est introuvable. Installe OpenSSH client sur Windows avant de lancer ce script."
}

if (-not $PublicKeyPath) {
    $PublicKeyPath = Resolve-DefaultPublicKeyPath
}

if (-not $PublicKeyPath) {
    throw "Aucune cle publique detectee. Cree d'abord une cle avec: ssh-keygen -t ed25519"
}

if (-not (Test-Path -LiteralPath $PublicKeyPath)) {
    throw "Fichier de cle publique introuvable: $PublicKeyPath"
}

if (-not $PrivateKeyPath) {
    $PrivateKeyPath = Resolve-MatchingPrivateKeyPath -PublicPath $PublicKeyPath
}

if ($PrivateKeyPath -and -not (Test-Path -LiteralPath $PrivateKeyPath)) {
    throw "Fichier de cle privee introuvable: $PrivateKeyPath"
}

$publicKey = (Get-Content -Raw -LiteralPath $PublicKeyPath).Trim()
if (-not $publicKey.StartsWith("ssh-")) {
    throw "Le fichier '$PublicKeyPath' ne ressemble pas a une cle publique OpenSSH valide."
}

$escapedPublicKey = $publicKey.Replace("'", "'""'""'")
$sshArgs = Get-SshCommonArgs -IdentityPath $PrivateKeyPath
$testArgs = @()
if ($PrivateKeyPath) {
    $testArgs += @("-i", $PrivateKeyPath, "-o", "IdentitiesOnly=yes", "-o", "PasswordAuthentication=no")
}

$remoteCommand = @(
    "umask 077"
    "mkdir -p ~/.ssh"
    "touch ~/.ssh/authorized_keys"
    "chmod 700 ~/.ssh"
    "chmod 600 ~/.ssh/authorized_keys"
    "grep -qxF '$escapedPublicKey' ~/.ssh/authorized_keys || printf '%s\n' '$escapedPublicKey' >> ~/.ssh/authorized_keys"
) -join "; "

Write-Host ""
Write-Host "==> Installation de la cle publique sur $Server" -ForegroundColor Cyan
Write-Host "Cle publique: $PublicKeyPath"
& ssh @sshArgs $Server $remoteCommand
if ($LASTEXITCODE -ne 0) {
    throw "Echec de l'installation de la cle publique sur le serveur."
}

if ($PrivateKeyPath) {
    Write-Host ""
    Write-Host "==> Test de connexion par cle" -ForegroundColor Cyan
    & ssh @testArgs $Server "echo AUTH_BY_KEY_OK"
    if ($LASTEXITCODE -ne 0) {
        throw "La cle publique a ete installee, mais le test de connexion par cle a echoue."
    }
}

Write-Host ""
Write-Host "Configuration terminee. Les prochains deployements peuvent utiliser la cle SSH." -ForegroundColor Green
