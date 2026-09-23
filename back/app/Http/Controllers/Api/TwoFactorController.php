<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\QrCodeService;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * MFA — cahier §10 « MFA administrateurs ». Ouvert à tout compte (pas
 * seulement admin) : plus sûr que de bloquer une activation volontaire, et
 * évite un verrouillage au tout premier login admin avant toute
 * configuration possible. Fortement recommandé pour les comptes admin —
 * voir DEPLOIEMENT.md.
 */
class TwoFactorController extends Controller
{
    /**
     * POST /api/two-factor/enable
     * Génère un secret (non confirmé) et le QR à scanner. Le secret n'est
     * définitivement activé qu'après vérification d'un code via /confirm.
     */
    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasTwoFactorEnabled()) {
            return response()->json(['message' => 'La double authentification est déjà activée.'], 422);
        }

        $secret = TwoFactorService::generateSecret();
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null])->save();

        $uri = TwoFactorService::otpauthUri($secret, $user->email);

        return response()->json([
            'secret'   => $secret, // saisie manuelle si le QR ne peut pas être scanné
            'qr_svg'   => QrCodeService::generateSvg($uri, 220),
            'otpauth'  => $uri,
        ]);
    }

    /**
     * POST /api/two-factor/confirm — { code }
     * Valide le premier code TOTP et active réellement la 2FA. Renvoie les
     * codes de récupération une seule fois : à faire noter à l'utilisateur.
     */
    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        if (! $user->two_factor_secret) {
            return response()->json(['message' => 'Aucune activation en cours. Relancez /two-factor/enable.'], 422);
        }

        if (! TwoFactorService::verify($user->two_factor_secret, $data['code'])) {
            return response()->json(['message' => 'Code invalide.'], 422);
        }

        $recoveryCodes = TwoFactorService::generateRecoveryCodes();

        $user->forceFill([
            'two_factor_confirmed_at'    => now(),
            'two_factor_recovery_codes'  => $recoveryCodes,
        ])->save();

        AuditLog::record('auth.two_factor_enabled', $user);

        return response()->json(['recovery_codes' => $recoveryCodes]);
    }

    /**
     * POST /api/two-factor/disable — { password }
     */
    public function disable(Request $request): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string']]);
        $user = $request->user();

        if (! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Mot de passe incorrect.'], 422);
        }

        $user->forceFill([
            'two_factor_secret'         => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at'   => null,
        ])->save();

        AuditLog::record('auth.two_factor_disabled', $user);

        return response()->json(['ok' => true]);
    }

    /**
     * GET /api/two-factor/status
     */
    public function status(Request $request): JsonResponse
    {
        return response()->json([
            'enabled' => $request->user()->hasTwoFactorEnabled(),
        ]);
    }
}
