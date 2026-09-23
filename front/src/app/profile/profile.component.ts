import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TwoFactorService, TwoFactorEnableResponse } from '../services/two-factor.service';
import { AuthService } from '../services/auth.service';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';

/**
 * Mon compte — cahier §10 « MFA administrateurs ». Ouvert à tout rôle :
 * fortement recommandé pour les comptes admin (voir DEPLOIEMENT.md), mais
 * disponible à tous pour rester cohérent avec un mécanisme de sécurité
 * optionnel plutôt que de le réserver arbitrairement.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, IconComponent],
  template: `
    <div class="page-header fade-up">
      <div>
        <h1 class="page-title"><app-icon name="customers" [size]="24"></app-icon> Mon compte</h1>
        <p class="page-sub">{{ (auth.currentUser$ | async)?.name }} — {{ (auth.currentUser$ | async)?.email }}</p>
      </div>
    </div>

    <div class="settings-card fade-up">
      <h3>🔐 Double authentification (MFA)</h3>
      <p class="settings-desc">
        Exige un code temporaire en plus du mot de passe à chaque connexion —
        recommandé pour tous les comptes internes, en particulier les administrateurs.
      </p>

      <!-- État : chargement -->
      <div *ngIf="loadingStatus" class="skeleton" style="height:2rem;width:240px;"></div>

      <!-- État : désactivée, pas d'activation en cours -->
      <ng-container *ngIf="!loadingStatus && !enabled && step === 'idle'">
        <div class="status-row"><span class="status-pill status-off">Désactivée</span></div>
        <app-button variant="primary" size="md" (btnClick)="startEnable()" [isLoading]="working">
          Activer la double authentification
        </app-button>
      </ng-container>

      <!-- État : activée -->
      <ng-container *ngIf="!loadingStatus && enabled && step === 'idle'">
        <div class="status-row"><span class="status-pill status-on">Activée</span></div>
        <div class="disable-form">
          <input type="password" class="popup-input" placeholder="Mot de passe (pour désactiver)" [(ngModel)]="disablePassword" name="disablePassword">
          <app-button variant="secondary" size="md" [isDanger]="true" [isLoading]="working" [disabled]="!disablePassword" (btnClick)="disable()">
            Désactiver
          </app-button>
        </div>
      </ng-container>

      <!-- Étape : scan du QR -->
      <div *ngIf="step === 'scan'" class="mfa-step">
        <p>1. Scannez ce QR avec Google Authenticator, 1Password ou une app compatible TOTP.</p>
        <div class="qr-box" [innerHTML]="qrSvg"></div>
        <p class="manual-secret">Ou saisie manuelle : <code>{{ enableData?.secret }}</code></p>

        <p>2. Entrez le code à 6 chiffres affiché par l'application :</p>
        <div class="confirm-row">
          <input type="text" class="popup-input mono" maxlength="6" inputmode="numeric" placeholder="123456" [(ngModel)]="confirmCode" name="confirmCode">
          <app-button variant="primary" size="md" [isLoading]="working" [disabled]="confirmCode.length !== 6" (btnClick)="confirm()">
            Confirmer
          </app-button>
        </div>
        <div class="popup-banner-error" *ngIf="error">{{ error }}</div>
        <button type="button" class="cancel-link" (click)="cancel()">Annuler</button>
      </div>

      <!-- Étape : codes de récupération -->
      <div *ngIf="step === 'recovery'" class="mfa-step">
        <div class="popup-banner-error" style="background: var(--warning-bg, rgba(234,179,8,.1)); color: inherit;">
          ⚠️ Notez ces codes maintenant — ils ne seront plus jamais affichés. Chacun ne peut être utilisé qu'une fois,
          en cas de perte de votre appareil d'authentification.
        </div>
        <div class="recovery-grid">
          <code *ngFor="let c of recoveryCodes">{{ c }}</code>
        </div>
        <app-button variant="primary" size="md" (btnClick)="finishRecoveryAck()">J'ai noté ces codes</app-button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 1.75rem 2rem; max-width: 720px; margin: 0 auto; }
    .settings-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 0.9rem; padding: 1.5rem; }
    .settings-card h3 { margin: 0 0 0.4rem; font-size: 1rem; }
    .settings-desc { font-size: 0.84rem; color: var(--text-secondary); margin: 0 0 1rem; line-height: 1.5; }
    .status-row { margin-bottom: 0.9rem; }
    .status-pill { display: inline-flex; padding: 3px 11px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
    .status-off { background: rgba(148,163,184,.15); color: #94a3b8; }
    .status-on  { background: rgba(34,197,94,.15); color: #4ade80; }
    .disable-form { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .mfa-step p { font-size: 0.85rem; margin: 0.9rem 0 0.5rem; }
    .qr-box { background: #fff; padding: 0.75rem; border-radius: 0.6rem; display: inline-block; line-height: 0; }
    .qr-box ::ng-deep svg { width: 200px; height: 200px; }
    .manual-secret { font-size: 0.78rem; color: var(--text-muted); }
    .manual-secret code { background: var(--input-bg); padding: 2px 6px; border-radius: 4px; }
    .confirm-row { display: flex; gap: 0.6rem; align-items: center; }
    .cancel-link { margin-top: 0.75rem; background: none; border: none; color: var(--text-muted); font-size: 0.8rem; cursor: pointer; text-decoration: underline; }
    .recovery-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin: 1rem 0; }
    .recovery-grid code { background: var(--input-bg); padding: 0.5rem; border-radius: 0.4rem; text-align: center; font-size: 0.85rem; }
  `]
})
export class ProfileComponent implements OnInit {
  loadingStatus = true;
  enabled = false;
  working = false;
  error = '';
  step: 'idle' | 'scan' | 'recovery' = 'idle';
  enableData: TwoFactorEnableResponse | null = null;
  qrSvg: SafeHtml | null = null;
  confirmCode = '';
  recoveryCodes: string[] = [];
  disablePassword = '';

  constructor(
    private twoFactorService: TwoFactorService,
    public auth: AuthService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.twoFactorService.status().subscribe({
      next: (res) => { this.enabled = res.enabled; this.loadingStatus = false; this.cdr.markForCheck(); },
      error: () => { this.loadingStatus = false; this.cdr.markForCheck(); }
    });
  }

  startEnable() {
    this.working = true;
    this.error = '';
    this.twoFactorService.enable().subscribe({
      next: (res) => {
        this.enableData = res;
        this.qrSvg = this.sanitizer.bypassSecurityTrustHtml(res.qr_svg);
        this.step = 'scan';
        this.working = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.working = false;
        this.error = err.error?.message || 'Impossible de démarrer l\'activation.';
        this.cdr.markForCheck();
      }
    });
  }

  confirm() {
    this.working = true;
    this.error = '';
    this.twoFactorService.confirm(this.confirmCode).subscribe({
      next: (res) => {
        this.recoveryCodes = res.recovery_codes;
        this.step = 'recovery';
        this.enabled = true;
        this.working = false;
        this.confirmCode = '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.working = false;
        this.error = err.error?.message || 'Code invalide.';
        this.cdr.markForCheck();
      }
    });
  }

  finishRecoveryAck() {
    this.step = 'idle';
    this.recoveryCodes = [];
    this.cdr.markForCheck();
  }

  cancel() {
    this.step = 'idle';
    this.enableData = null;
    this.qrSvg = null;
    this.confirmCode = '';
    this.error = '';
    this.cdr.markForCheck();
  }

  disable() {
    this.working = true;
    this.twoFactorService.disable(this.disablePassword).subscribe({
      next: () => {
        this.enabled = false;
        this.working = false;
        this.disablePassword = '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.working = false;
        this.error = err.error?.message || 'Mot de passe incorrect.';
        this.cdr.markForCheck();
      }
    });
  }
}
