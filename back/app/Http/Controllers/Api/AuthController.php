<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
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
