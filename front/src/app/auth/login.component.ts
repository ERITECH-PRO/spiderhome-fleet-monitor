import { Component, OnDestroy } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { IconComponent } from '../shared/components/icon/icon.component';
import { DataPreloadService } from '../services/data-preload.service';
import { ThemeService } from '../services/theme.service';

import { SpiderHomeLogoComponent } from '../shared/components/spiderhome-logo/spiderhome-logo.component';

export type LoginViewMode = 'login' | 'forgot_email' | 'forgot_otp' | 'forgot_password' | 'forgot_success';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SpiderHomeLogoComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnDestroy {
  // Login credentials
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  // Password visibility toggle
  showPassword = false;

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // Forgot password flow state
  viewMode: LoginViewMode = 'login';
  forgotEmail = '';
  otpCode = '';
  newPassword = '';
  newPasswordConfirm = '';
  resetToken = '';
  forgotErrorMessage = '';
  forgotSuccessMessage = '';
  isForgotLoading = false;

  // Resend OTP countdown
  resendCountdown = 0;
  private countdownTimer: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private preloadService: DataPreloadService,
    public theme: ThemeService
  ) {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  // ── Standard Login ──────────────────────────────────────────────────────────

  onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        if (res.ok) {
          this.preloadService.preloadAll();
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = res.message || 'Erreur de connexion';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Identifiants incorrects ou serveur indisponible.';
        this.isLoading = false;
      }
    });
  }

  // ── Forgot Password Navigation ──────────────────────────────────────────────

  openForgotPassword() {
    this.viewMode = 'forgot_email';
    this.forgotEmail = this.email || '';
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';
    this.otpCode = '';
    this.newPassword = '';
    this.newPasswordConfirm = '';
    this.resetToken = '';
  }

  backToLogin() {
    this.viewMode = 'login';
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';
    this.clearTimer();
  }

  // ── Step 1: Request 6-digit OTP Code via Brevo ──────────────────────────────

  onRequestOtp() {
    if (!this.forgotEmail) {
      this.forgotErrorMessage = 'Veuillez renseigner votre adresse e-mail professionnelle.';
      return;
    }

    this.isForgotLoading = true;
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';

    this.authService.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.isForgotLoading = false;
        if (res.ok) {
          this.viewMode = 'forgot_otp';
          this.forgotSuccessMessage = res.message || 'Code envoyé avec succès par e-mail.';
          this.startResendTimer(60);
        } else {
          this.forgotErrorMessage = res.message || "Erreur lors de l'envoi du code.";
        }
      },
      error: (err) => {
        this.isForgotLoading = false;
        this.forgotErrorMessage = err.error?.message || "Adresse e-mail introuvable ou erreur du serveur.";
      }
    });
  }

  goToForgotEmail() {
    this.viewMode = 'forgot_email';
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';
  }

  // ── Step 2: Verify 6-digit OTP Code ─────────────────────────────────────────

  onVerifyOtp() {
    const cleanOtp = (this.otpCode || '').replace(/\s+/g, '');

    if (!cleanOtp || cleanOtp.length !== 6) {
      this.forgotErrorMessage = 'Veuillez saisir le code de vérification à 6 chiffres.';
      return;
    }

    this.isForgotLoading = true;
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';

    this.authService.verifyOtp(this.forgotEmail, cleanOtp).subscribe({
      next: (res) => {
        this.isForgotLoading = false;
        if (res.ok) {
          this.resetToken = res.reset_token || '';
          this.viewMode = 'forgot_password';
          this.forgotSuccessMessage = 'Code validé avec succès. Définissez votre nouveau mot de passe.';
        } else {
          this.forgotErrorMessage = res.message || 'Code de vérification incorrect.';
        }
      },
      error: (err) => {
        this.isForgotLoading = false;
        this.forgotErrorMessage = err.error?.message || 'Code invalide ou expiré.';
      }
    });
  }

  // ── Step 3: Set New Password ────────────────────────────────────────────────

  onResetPassword() {
    if (!this.newPassword || !this.newPasswordConfirm) {
      this.forgotErrorMessage = 'Veuillez remplir et confirmer votre nouveau mot de passe.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.forgotErrorMessage = 'Le mot de passe doit comporter au moins 6 caractères.';
      return;
    }

    if (this.newPassword !== this.newPasswordConfirm) {
      this.forgotErrorMessage = 'Les deux mots de passe ne correspondent pas.';
      return;
    }

    this.isForgotLoading = true;
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';

    const cleanOtp = (this.otpCode || '').replace(/\s+/g, '');

    this.authService.resetPassword({
      email: this.forgotEmail,
      password: this.newPassword,
      password_confirmation: this.newPasswordConfirm,
      reset_token: this.resetToken || undefined,
      otp: cleanOtp || undefined,
    }).subscribe({
      next: (res) => {
        this.isForgotLoading = false;
        if (res.ok) {
          this.viewMode = 'forgot_success';
          this.forgotSuccessMessage = res.message || 'Votre mot de passe a été mis à jour avec succès.';
          // Pre-fill login email
          this.email = this.forgotEmail;
          this.password = '';
        } else {
          this.forgotErrorMessage = res.message || 'Erreur lors de la réinitialisation.';
        }
      },
      error: (err) => {
        this.isForgotLoading = false;
        this.forgotErrorMessage = err.error?.message || 'Erreur lors de la réinitialisation du mot de passe.';
      }
    });
  }

  // ── Resend Code Logic ───────────────────────────────────────────────────────

  onResendOtp() {
    if (this.resendCountdown > 0 || this.isForgotLoading) {
      return;
    }

    this.isForgotLoading = true;
    this.forgotErrorMessage = '';

    this.authService.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.isForgotLoading = false;
        this.forgotSuccessMessage = res.message || 'Un nouveau code à 6 chiffres a été expédié par e-mail.';
        this.startResendTimer(60);
      },
      error: (err) => {
        this.isForgotLoading = false;
        this.forgotErrorMessage = err.error?.message || 'Erreur lors du renvoi du code.';
      }
    });
  }

  private startResendTimer(seconds: number) {
    this.clearTimer();
    this.resendCountdown = seconds;
    this.countdownTimer = setInterval(() => {
      if (this.resendCountdown > 0) {
        this.resendCountdown--;
      } else {
        this.clearTimer();
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
