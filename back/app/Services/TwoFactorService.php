<?php

namespace App\Services;

/**
 * TOTP (RFC 6238) implémenté en PHP pur — aucune dépendance Composer.
 *
 * Compatible avec Google Authenticator, Authy, 1Password, etc. : secret en
 * Base32, HMAC-SHA1, 6 chiffres, fenêtre de 30 secondes — les paramètres
 * standards que tout lecteur de QR TOTP grand public attend par défaut.
 */
class TwoFactorService
{
    private const SECRET_BYTES = 20; // 160 bits, standard TOTP
    private const DIGITS       = 6;
    private const PERIOD       = 30; // secondes
    private const WINDOW       = 1;  // tolère ±1 période (horloges légèrement désynchronisées)

    /** Génère un secret aléatoire encodé en Base32. */
    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(self::SECRET_BYTES));
    }

    /** URI otpauth:// à encoder en QR pour une application d'authentification. */
    public static function otpauthUri(string $secret, string $accountEmail, string $issuer = 'SpiderHome Fleet Monitor'): string
    {
        $label = rawurlencode($issuer) . ':' . rawurlencode($accountEmail);

        return sprintf(
            'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d',
            $label,
            $secret,
            rawurlencode($issuer),
            self::DIGITS,
            self::PERIOD
        );
    }

    /**
     * Vérifie un code à 6 chiffres saisi par l'utilisateur, avec tolérance
     * de dérive d'horloge (±1 période de part et d'autre).
     */
    public static function verify(string $secret, string $code): bool
    {
        $code = trim($code);
        if (! preg_match('/^\d{6}$/', $code)) {
            return false;
        }

        $timestep = (int) floor(time() / self::PERIOD);

        for ($i = -self::WINDOW; $i <= self::WINDOW; $i++) {
            if (hash_equals(self::generateCode($secret, $timestep + $i), $code)) {
                return true;
            }
        }

        return false;
    }

    /** Génère 8 codes de récupération à usage unique (format XXXX-XXXX). */
    public static function generateRecoveryCodes(int $count = 8): array
    {
        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            $codes[] = strtoupper(substr(bin2hex(random_bytes(4)), 0, 4) . '-' . substr(bin2hex(random_bytes(4)), 0, 4));
        }

        return $codes;
    }

    // ── Algorithme TOTP/HOTP (RFC 4226 / 6238) ───────────────────────────────

    private static function generateCode(string $base32Secret, int $timestep): string
    {
        $key = self::base32Decode($base32Secret);
        $time = pack('N*', 0) . pack('N*', $timestep); // 8 octets big-endian

        $hash = hash_hmac('sha1', $time, $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;

        $binary = ((ord($hash[$offset]) & 0x7F) << 24)
            | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8)
            | (ord($hash[$offset + 3]) & 0xFF);

        return str_pad((string) ($binary % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    private static function base32Encode(string $binary): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        foreach (str_split($binary) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $output = '';
        foreach (str_split($bits, 5) as $chunk) {
            if (strlen($chunk) < 5) {
                $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            }
            $output .= $alphabet[bindec($chunk)];
        }

        return $output;
    }

    private static function base32Decode(string $base32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $base32 = strtoupper(rtrim($base32, '='));

        $bits = '';
        foreach (str_split($base32) as $char) {
            $pos = strpos($alphabet, $char);
            if ($pos === false) {
                continue; // caractère invalide ignoré (tolérance de saisie)
            }
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }

        $binary = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $binary .= chr(bindec($byte));
            }
        }

        return $binary;
    }
}
