<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Exception;

class BrevoService
{
    protected string $apiKey;
    protected string $baseUrl;
    protected string $senderEmail;
    protected string $senderName;
    protected ?string $lastError = null;

    public function __construct()
    {
        $this->apiKey      = config('brevo.api_key')      ?? config('services.brevo.api_key')      ?? env('BREVO_API_KEY', '');
        $this->baseUrl     = config('brevo.base_url')     ?? config('services.brevo.base_url')     ?? env('BREVO_BASE_URL', 'https://api.brevo.com/v3');
        $this->senderEmail = config('brevo.sender_email') ?? config('services.brevo.sender_email') ?? env('BREVO_SENDER_EMAIL', 'contact@evolium.dev');
        $this->senderName  = config('brevo.sender_name')  ?? config('services.brevo.sender_name')  ?? env('BREVO_SENDER_NAME', 'Evolium');
    }

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

    /**
     * Send password reset verification code (6-digit OTP).
     * Primary: Laravel SMTP (Gmail). Fallback: Brevo REST API.
     *
     * @param string $recipientEmail
     * @param string $otpCode
     * @param string|null $recipientName
     * @return bool
     */
    public function sendPasswordResetOtp(string $recipientEmail, string $otpCode, ?string $recipientName = null): bool
    {
        $subject     = "Votre code de réinitialisation de mot de passe - SpiderHome Fleet Monitor";
        $htmlContent = $this->buildOtpHtmlTemplate($otpCode, $recipientName);

        // ── 1. Primary transport: Laravel SMTP (Gmail) ─────────────────────────
        if (config('mail.default') === 'smtp') {
            try {
                Mail::html($htmlContent, function ($message) use ($recipientEmail, $recipientName, $subject) {
                    $message->to($recipientEmail, $recipientName ?? 'Utilisateur SpiderHome')
                            ->subject($subject);
                });
                Log::info("BrevoService: OTP email sent via SMTP (Gmail) to {$recipientEmail}");
                $this->lastError = null;
                return true;
            } catch (Exception $mailEx) {
                Log::warning("BrevoService: SMTP sending failed, trying Brevo API: " . $mailEx->getMessage());
                // Fall through to Brevo REST API
            }
        }

        // ── 2. Fallback transport: Brevo REST API ──────────────────────────────
        return $this->sendViaBrevoApi($recipientEmail, $otpCode, $recipientName, $subject, $htmlContent);
    }

    /**
     * Send via Brevo REST API (used as fallback).
     */
    protected function sendViaBrevoApi(
        string $recipientEmail,
        string $otpCode,
        ?string $recipientName,
        string $subject,
        string $htmlContent
    ): bool {
        $url = rtrim($this->baseUrl, '/') . '/smtp/email';

        $payload = [
            'sender' => [
                'name'  => $this->senderName,
                'email' => $this->senderEmail,
            ],
            'to' => [
                [
                    'email' => $recipientEmail,
                    'name'  => $recipientName ?? 'Utilisateur SpiderHome',
                ]
            ],
            'subject'     => $subject,
            'htmlContent' => $htmlContent,
        ];

        try {
            $response = Http::withHeaders([
                'api-key'      => $this->apiKey,
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ])->timeout(10)->post($url, $payload);

            if ($response->successful()) {
                Log::info("BrevoService: OTP sent via Brevo API to {$recipientEmail}", [
                    'messageId' => $response->json('messageId')
                ]);
                $this->lastError = null;
                return true;
            }

            $body = $response->json();
            $msg  = is_array($body) ? ($body['message'] ?? $response->body()) : $response->body();

            if ($response->status() === 401 && str_contains($msg, 'unrecognised IP address')) {
                $this->lastError = "Brevo IP non autorisée. Ajoutez votre IP sur https://app.brevo.com/security/authorised_ips";
            } else {
                $this->lastError = "Brevo API erreur ({$response->status()}): {$msg}";
            }

            Log::error("BrevoService: Brevo API failed for {$recipientEmail}: {$this->lastError}");
            return false;

        } catch (Exception $e) {
            $this->lastError = "Erreur réseau Brevo: " . $e->getMessage();
            Log::error("BrevoService: Network exception for {$recipientEmail}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate modern, responsive HTML template for the OTP email.
     */
    protected function buildOtpHtmlTemplate(string $otpCode, ?string $recipientName): string
    {
        $nameGreeting = $recipientName ? htmlspecialchars($recipientName) : 'Bonjour';

        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de réinitialisation</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #070d1d;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
    }
    .container {
      max-width: 540px;
      margin: 30px auto;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .logo-badge {
      display: inline-block;
      width: 52px;
      height: 52px;
      line-height: 52px;
      background: linear-gradient(135deg, #4f46e5, #3b82f6);
      border-radius: 12px;
      font-size: 26px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 6px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin: 0;
    }
    .content {
      font-size: 15px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 24px;
    }
    .otp-box {
      text-align: center;
      margin: 28px 0;
      padding: 20px;
      background: #070d1d;
      border: 1px solid #334155;
      border-radius: 12px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #60a5fa;
      display: inline-block;
    }
    .expiry-note {
      font-size: 13px;
      color: #f59e0b;
      margin-top: 10px;
      font-weight: 600;
    }
    .warning {
      background: rgba(239, 68, 68, 0.1);
      border-left: 4px solid #ef4444;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #fca5a5;
      margin-bottom: 24px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #1e293b;
      padding-top: 20px;
      margin-top: 28px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">🕷️</div>
      <h1 class="title">SpiderHome Fleet Monitor</h1>
      <p class="subtitle">Sécurité &amp; Authentification — Propulsé par Evolium</p>
    </div>

    <div class="content">
      <p>Bonjour {$nameGreeting},</p>
      <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte d'accès à la plateforme de supervision <strong>SpiderHome Fleet Monitor</strong>.</p>
      <p>Voici votre code de vérification à 6 chiffres :</p>
    </div>

    <div class="otp-box">
      <div class="otp-code">{$otpCode}</div>
      <div class="expiry-note">⏱️ Ce code expire dans 15 minutes.</div>
    </div>

    <div class="warning">
      <strong>⚠️ Important :</strong> Ne communiquez jamais ce code. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
    </div>

    <div class="footer">
      <p>&copy; 2026 SpiderHome &bull; Evolium Technology. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
HTML;
    }
}
