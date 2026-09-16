<?php

namespace App\Services;

use App\Models\User;
use App\Models\PasswordResetOtp;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Exception;

class PasswordResetService
{
    public function __construct(
        protected BrevoService $brevoService
    ) {}

    /**
     * Step 1: Request a 6-digit OTP code for password reset.
     *
     * @param string $email
     * @return array
     */
    public function requestResetOtp(string $email): array
    {
        $user = User::where('email', $email)->first();

        if (! $user) {
            return [
                'ok'      => false,
                'status'  => 404,
                'message' => "Aucun compte n'est associé à l'adresse e-mail {$email}."
            ];
        }

        // Invalidate any older unused OTPs for this email to ensure single active code
        PasswordResetOtp::where('email', $email)
            ->whereNull('used_at')
            ->update(['used_at' => Carbon::now()]);

        // Generate a random 6-digit numeric OTP code
        $otp = sprintf('%06d', random_int(100000, 999999));

        // Save hashed OTP with 15-minute expiration
        $otpRecord = PasswordResetOtp::create([
            'email'      => $email,
            'otp_hash'   => Hash::make($otp),
            'expires_at' => Carbon::now()->addMinutes(15),
            'attempts'   => 0,
        ]);

        // Send email via Brevo
        $emailSent = $this->brevoService->sendPasswordResetOtp($email, $otp, $user->name);

        \Illuminate\Support\Facades\Log::info("Password reset OTP generated for {$email}: {$otp}");

        if (! $emailSent) {
            $errorMsg = $this->brevoService->getLastError() 
                ?? "Impossible d'envoyer l'e-mail de réinitialisation via Brevo. Veuillez vérifier la configuration réseau.";

            // En environnement de développement local (si Brevo bloque l'IP locale du développeur),
            // on permet la continuation du flux pour les tests et démonstrations.
            if (app()->environment('local')) {
                \Illuminate\Support\Facades\Log::warning("Brevo restreint : fallback dev activé pour {$email}. Code OTP généré : {$otp}");
                return [
                    'ok'                 => true,
                    'status'             => 200,
                    'message'            => "Code généré : {$otp} (Mode Dev/Démo - Consultez la console ou entrez ce code)",
                    'dev_otp'            => $otp,
                    'expires_in_minutes' => 15,
                ];
            }

            return [
                'ok'      => false,
                'status'  => 500,
                'message' => $errorMsg
            ];
        }

        return [
            'ok'                 => true,
            'status'             => 200,
            'message'            => "Un code de vérification à 6 chiffres a été envoyé par e-mail à {$email}.",
            'expires_in_minutes' => 15,
        ];
    }

    /**
     * Step 2: Verify the 6-digit OTP code submitted by the user.
     *
     * @param string $email
     * @param string $otp
     * @return array
     */
    public function verifyResetOtp(string $email, string $otp): array
    {
        $otpRecord = PasswordResetOtp::where('email', $email)
            ->whereNull('used_at')
            ->where('expires_at', '>', Carbon::now())
            ->latest('id')
            ->first();

        if (! $otpRecord) {
            return [
                'ok'      => false,
                'status'  => 400,
                'message' => "Le code de vérification a expiré ou est introuvable. Veuillez demander un nouveau code."
            ];
        }

        // Brute-force protection: check attempts limit
        if ($otpRecord->attempts >= 5) {
            $otpRecord->markAsUsed();
            return [
                'ok'      => false,
                'status'  => 429,
                'message' => "Nombre maximal de tentatives de validation atteint (5/5). Ce code a été révoqué pour des raisons de sécurité."
            ];
        }

        // Verify the OTP against the stored hash
        if (! Hash::check($otp, $otpRecord->otp_hash)) {
            $otpRecord->increment('attempts');
            $remaining = 5 - $otpRecord->attempts;
            return [
                'ok'      => false,
                'status'  => 400,
                'message' => "Code de vérification incorrect. ({$remaining} tentative(s) restante(s))."
            ];
        }

        // OTP is valid → generate a secure one-time reset token
        $resetToken = Str::random(64);
        $otpRecord->update(['reset_token' => $resetToken]);

        return [
            'ok'          => true,
            'status'      => 200,
            'message'     => "Code de vérification validé avec succès.",
            'reset_token' => $resetToken,
        ];
    }

    /**
     * Step 3: Reset the user's password using the validated reset token or OTP.
     *
     * @param string $email
     * @param string $newPassword
     * @param string|null $resetToken
     * @param string|null $otp
     * @return array
     */
    public function resetPassword(string $email, string $newPassword, ?string $resetToken = null, ?string $otp = null): array
    {
        $user = User::where('email', $email)->first();

        if (! $user) {
            return [
                'ok'      => false,
                'status'  => 404,
                'message' => "Utilisateur introuvable."
            ];
        }

        $query = PasswordResetOtp::where('email', $email)
            ->whereNull('used_at')
            ->where('expires_at', '>', Carbon::now());

        if ($resetToken) {
            $otpRecord = $query->where('reset_token', $resetToken)->latest('id')->first();
        } elseif ($otp) {
            $otpRecord = $query->latest('id')->first();
            if ($otpRecord && ! Hash::check($otp, $otpRecord->otp_hash)) {
                $otpRecord = null;
            }
        } else {
            $otpRecord = null;
        }

        if (! $otpRecord) {
            return [
                'ok'      => false,
                'status'  => 400,
                'message' => "Session de réinitialisation expirée ou invalide. Veuillez recommencer la procédure."
            ];
        }

        // Update user's password
        $user->password = Hash::make($newPassword);
        $user->save();

        // Revoke all existing Sanctum API tokens to enforce clean re-authentication
        if (method_exists($user, 'tokens')) {
            $user->tokens()->delete();
        }

        // Invalidate OTP (single-use guarantee)
        $otpRecord->markAsUsed();

        return [
            'ok'      => true,
            'status'  => 200,
            'message' => "Votre mot de passe a été réinitialisé avec succès. Vous pouvez dès à présent vous connecter."
        ];
    }
}
