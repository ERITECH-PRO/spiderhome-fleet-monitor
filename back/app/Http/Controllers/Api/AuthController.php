<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\TwoFactorService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /** Durée de vie du jeton de défi 2FA — le temps de saisir un code TOTP. */
    private const CHALLENGE_TTL_SECONDS = 300;

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            // Échec de connexion : REC-11 (audit) — utile pour détecter du
            // bourrage de mot de passe. Ne révèle jamais si l'e-mail existe.
            AuditLog::record('auth.login_failed', null, ['email' => $request->email]);

            return response()->json([
                'ok' => false,
                'message' => 'Identifiants incorrects.'
            ], 401);
        }

        // MFA — cahier §10 : le mot de passe seul ne suffit pas à obtenir un
        // jeton d'accès si la double authentification est activée.
        if ($user->hasTwoFactorEnabled()) {
            $challenge = Str::random(64);
            Cache::put("2fa_challenge:{$challenge}", $user->id, self::CHALLENGE_TTL_SECONDS);

            AuditLog::record('auth.login_password_ok_awaiting_2fa', $user);

            return response()->json([
                'ok'                => true,
                'requires_2fa'      => true,
                'challenge_token'   => $challenge,
                'expires_in'        => self::CHALLENGE_TTL_SECONDS,
            ]);
        }

        return $this->issueToken($user);
    }

    /**
     * POST /api/login/2fa — { challenge_token, code }
     * Second facteur : code TOTP à 6 chiffres, ou un code de récupération
     * à usage unique (format XXXX-XXXX) si l'appareil est indisponible.
     */
    public function loginTwoFactor(Request $request)
    {
        $data = $request->validate([
            'challenge_token' => 'required|string',
            'code'            => 'required|string',
        ]);

        $userId = Cache::get("2fa_challenge:{$data['challenge_token']}");
        if (! $userId) {
            return response()->json(['ok' => false, 'message' => 'Session de connexion expirée. Reconnectez-vous.'], 419);
        }

        $user = User::find($userId);
        if (! $user || ! $user->hasTwoFactorEnabled()) {
            return response()->json(['ok' => false, 'message' => 'Identifiants incorrects.'], 401);
        }

        $code = trim($data['code']);
        $isTotp = TwoFactorService::verify($user->two_factor_secret, $code);
        $isRecovery = false;

        if (! $isTotp) {
            $recoveryCodes = $user->two_factor_recovery_codes ?? [];
            $normalized = strtoupper($code);
            if (in_array($normalized, $recoveryCodes, true)) {
                $isRecovery = true;
                // Usage unique : on retire le code consommé.
                $user->forceFill([
                    'two_factor_recovery_codes' => array_values(array_diff($recoveryCodes, [$normalized])),
                ])->save();
            }
        }

        if (! $isTotp && ! $isRecovery) {
            AuditLog::record('auth.two_factor_failed', $user);

            return response()->json(['ok' => false, 'message' => 'Code invalide.'], 422);
        }

        Cache::forget("2fa_challenge:{$data['challenge_token']}");

        if ($isRecovery) {
            AuditLog::record('auth.two_factor_recovery_code_used', $user);
        }

        return $this->issueToken($user);
    }

    private function issueToken(User $user)
    {
        // Revoke older tokens to ensure clean session (optional but good practice)
        $user->tokens()->delete();

        $token = $user->createToken('auth_token')->plainTextToken;

        AuditLog::record('auth.login', $user);

        return response()->json([
            'ok' => true,
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'customer_id' => $user->customer_id,
                'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            ]
        ]);
    }

    public function logout(Request $request)
    {
        AuditLog::record('auth.logout', $request->user());

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'ok' => true,
            'message' => 'Déconnexion réussie'
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'ok' => true,
            'user' => $request->user()
        ]);
    }
}
