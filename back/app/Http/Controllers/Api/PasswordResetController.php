<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PasswordResetService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PasswordResetController extends Controller
{
    public function __construct(
        protected PasswordResetService $passwordResetService
    ) {}

    /**
     * Request a 6-digit OTP code to be sent via Brevo email.
     *
     * POST /api/forgot-password
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ], [
            'email.required' => "L'adresse e-mail est obligatoire.",
            'email.email'    => "L'adresse e-mail doit être valide.",
        ]);

        $result = $this->passwordResetService->requestResetOtp($validated['email']);

        return response()->json($result, $result['status'] ?? 200);
    }

    /**
     * Verify the 6-digit OTP code submitted by the user.
     *
     * POST /api/verify-otp
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'otp'   => 'required|string|size:6',
        ], [
            'email.required' => "L'adresse e-mail est obligatoire.",
            'otp.required'   => "Le code de vérification est obligatoire.",
            'otp.size'       => "Le code de vérification doit comporter exactement 6 chiffres.",
        ]);

        $result = $this->passwordResetService->verifyResetOtp($validated['email'], $validated['otp']);

        return response()->json($result, $result['status'] ?? 200);
    }

    /**
     * Reset password using reset_token (or OTP) and new password.
     *
     * POST /api/reset-password
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email'                 => 'required|email',
            'password'              => 'required|string|min:6|confirmed',
            'reset_token'           => 'nullable|string',
            'otp'                   => 'nullable|string|size:6',
        ], [
            'email.required'        => "L'adresse e-mail est obligatoire.",
            'password.required'     => "Le nouveau mot de passe est obligatoire.",
            'password.min'          => "Le mot de passe doit contenir au moins 6 caractères.",
            'password.confirmed'    => "La confirmation du mot de passe ne correspond pas.",
        ]);

        $result = $this->passwordResetService->resetPassword(
            $validated['email'],
            $validated['password'],
            $validated['reset_token'] ?? null,
            $validated['otp'] ?? null
        );

        return response()->json($result, $result['status'] ?? 200);
    }
}
