import { Component, EventEmitter, Input, Output, OnDestroy, OnChanges, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

// BarcodeDetector n'est pas encore dans les types TypeScript standard (API récente, Chrome/Edge).
declare global {
  interface Window { BarcodeDetector?: any; }
}

/**
 * Scanner de QR code via la caméra — cahier §7.1 : « Scanner un QR code
 * pour rattacher une carte au client et au site. »
 *
 * Utilise l'API navigateur native `BarcodeDetector` (Chrome/Edge/Opera) —
 * aucune librairie JS tierce, donc aucun risque de dépendance non testable
 * dans cet environnement (contrairement aux deux dépendances Composer déjà
 * ajoutées cette session). Sur un navigateur sans support (Firefox, Safari
 * à ce jour), affiche un message clair plutôt que d'échouer silencieusement.
 *
 * Nécessite HTTPS (ou localhost) — comme toute utilisation de la caméra
 * dans un navigateur.
 */
@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="scanner-overlay" *ngIf="isOpen" (click)="close()">
      <div class="scanner-box" (click)="$event.stopPropagation()">
        <div class="scanner-header">
          <h3><app-icon name="qr-code" [size]="18"></app-icon> Scanner un module</h3>
          <button type="button" class="scanner-close" (click)="close()" aria-label="Fermer">✕</button>
        </div>

        <div *ngIf="!supported" class="scanner-unsupported">
          <p>⚠️ Ce navigateur ne supporte pas le scan de QR intégré.</p>
          <p class="hint">Utilisez Chrome, Edge ou Opera — ou recherchez le module directement par son numéro de série dans la liste.</p>
        </div>

        <div *ngIf="supported && cameraError" class="scanner-unsupported">
          <p>⚠️ Caméra inaccessible.</p>
          <p class="hint">{{ cameraError }}</p>
        </div>

        <div *ngIf="supported && !cameraError" class="scanner-video-wrap">
          <video #videoEl autoplay playsinline muted></video>
          <div class="scan-frame"></div>
        </div>

        <p class="scanner-instructions" *ngIf="supported && !cameraError">
          Cadrez le QR imprimé sur le module — la fiche s'ouvre automatiquement dès la détection.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .scanner-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 500;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .scanner-box {
      background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 1rem;
      width: 100%; max-width: 420px; padding: 1.25rem; box-shadow: 0 20px 50px rgba(0,0,0,.4);
    }
    .scanner-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
    .scanner-header h3 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1rem; }
    .scanner-close { background: none; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer; }
    .scanner-video-wrap { position: relative; border-radius: 0.75rem; overflow: hidden; background: #000; aspect-ratio: 1; }
    .scanner-video-wrap video { width: 100%; height: 100%; object-fit: cover; }
    .scan-frame {
      position: absolute; inset: 12%; border: 3px solid rgba(74, 222, 128, .8); border-radius: 0.75rem;
      box-shadow: 0 0 0 999px rgba(0,0,0,.35); pointer-events: none;
    }
    .scanner-instructions { text-align: center; font-size: 0.78rem; color: var(--text-muted); margin: 0.75rem 0 0; }
    .scanner-unsupported { text-align: center; padding: 2rem 1rem; }
    .scanner-unsupported .hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; }
  `]
})
export class QrScannerComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() scanned = new EventEmitter<string>();
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;

  supported = typeof window !== 'undefined' && !!window.BarcodeDetector;
  cameraError: string | null = null;

  private stream: MediaStream | null = null;
  private detector: any = null;
  private scanLoopHandle: number | null = null;
  private hasEmitted = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    if (this.isOpen) {
      this.hasEmitted = false;
      this.cameraError = null;
      if (this.supported) {
        // Laisse le temps au <video> du template de se monter avant d'attacher le flux.
        setTimeout(() => this.startCamera(), 0);
      }
    } else {
      this.stopCamera();
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private async startCamera(): Promise<void> {
    try {
      this.detector = new window.BarcodeDetector!({ formats: ['qr_code'] });
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

      if (this.videoEl) {
        this.videoEl.nativeElement.srcObject = this.stream;
      }

      this.scanLoop();
    } catch (err: any) {
      this.cameraError = err?.name === 'NotAllowedError'
        ? 'Accès à la caméra refusé — autorisez-le dans les paramètres du navigateur.'
        : 'Impossible de démarrer la caméra (HTTPS requis, sauf en local).';
      this.cdr.markForCheck();
    }
  }

  private scanLoop(): void {
    if (!this.isOpen || this.hasEmitted || !this.videoEl) return;

    this.detector.detect(this.videoEl.nativeElement)
      .then((codes: any[]) => {
        if (codes.length > 0 && !this.hasEmitted) {
          this.hasEmitted = true;
          this.scanned.emit(codes[0].rawValue);
          this.close();
          return;
        }
        this.scanLoopHandle = requestAnimationFrame(() => this.scanLoop());
      })
      .catch(() => {
        this.scanLoopHandle = requestAnimationFrame(() => this.scanLoop());
      });
  }

  private stopCamera(): void {
    if (this.scanLoopHandle) {
      cancelAnimationFrame(this.scanLoopHandle);
      this.scanLoopHandle = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  close(): void {
    this.stopCamera();
    this.closed.emit();
  }
}
