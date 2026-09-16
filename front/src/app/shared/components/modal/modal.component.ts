import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type ModalType = 'default' | 'danger' | 'warning' | 'info' | 'success';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      *ngIf="isOpen"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="title ? 'modal-title' : null"
    >
      <div class="modal-container" [ngClass]="['size-' + size, 'type-' + type]">
        <!-- Header -->
        <header class="modal-header" *ngIf="title || showCloseBtn">
          <div class="modal-title-wrap">
            <span class="modal-icon" *ngIf="icon" aria-hidden="true">{{ icon }}</span>
            <h2 id="modal-title" class="modal-title">{{ title }}</h2>
          </div>
          <button
            *ngIf="showCloseBtn"
            type="button"
            class="modal-close-btn"
            (click)="close.emit()"
            aria-label="Fermer la boîte de dialogue"
            title="Fermer (Échap)"
          >
            <app-icon name="x" [size]="16" aria-hidden="true"></app-icon>
          </button>
        </header>

        <!-- Body / Content -->
        <main class="modal-body">
          <ng-content></ng-content>
        </main>

        <!-- Footer -->
        <footer class="modal-footer" *ngIf="hasFooter">
          <ng-content select="[modal-footer]"></ng-content>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    /* ── Backdrop overlay ─────────────────────────────────────────────────── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background-color: var(--modal-backdrop);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      animation: backdropFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes backdropFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Container box ────────────────────────────────────────────────────── */
    .modal-container {
      background-color: var(--modal-bg);
      border: 1px solid var(--border-card);
      border-radius: 1.25rem;
      box-shadow: var(--shadow-lg);
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform-origin: center center;
      animation: modalSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: background-color 0.25s ease, border-color 0.25s ease;
    }

    @keyframes modalSlideUp {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(12px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    /* ── Size variants ────────────────────────────────────────────────────── */
    .size-sm  { max-width: 24rem; }   /* 384px */
    .size-md  { max-width: 30rem; }   /* 480px — confirmations */
    .size-lg  { max-width: 34rem; }   /* 544px */
    .size-xl  { max-width: 42rem; }   /* 672px — forms */
    .size-2xl { max-width: 52rem; }   /* 832px — complex forms */
    .size-3xl { max-width: 62rem; }   /* 992px — detail panels */

    /* ── Type variants — header accent line ───────────────────────────────── */
    .type-danger  .modal-header { border-bottom-color: rgba(225, 29, 72, 0.25); }
    .type-warning .modal-header { border-bottom-color: rgba(245, 158, 11, 0.25); }
    .type-info    .modal-header { border-bottom-color: rgba(99, 102, 241, 0.25); }
    .type-success .modal-header { border-bottom-color: rgba(16, 185, 129, 0.25); }

    /* ── Header ───────────────────────────────────────────────────────────── */
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.1rem 1.5rem;
      border-bottom: 1px solid var(--border-card);
      background-color: var(--modal-header-bg);
      flex-shrink: 0;
      gap: 0.75rem;
    }

    .modal-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-width: 0;
    }

    .modal-icon {
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .modal-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--heading);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .modal-close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .modal-close-btn:hover {
      color: var(--heading);
      background-color: var(--card-hover);
      transform: scale(1.08);
    }

    .modal-close-btn:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    /* ── Body ─────────────────────────────────────────────────────────────── */
    .modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1 1 auto;
      color: var(--text);
    }

    /* Custom scrollbar for modal body */
    .modal-body::-webkit-scrollbar       { width: 5px; }
    .modal-body::-webkit-scrollbar-track { background: transparent; }
    .modal-body::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 9999px;
    }
    .modal-body::-webkit-scrollbar-thumb:hover {
      background: var(--scrollbar-hover);
    }

    /* ── Footer ───────────────────────────────────────────────────────────── */
    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-card);
      background-color: var(--modal-footer-bg);
      flex-shrink: 0;
    }

    /* ── Responsive — mobile ─────────────────────────────────────────────── */
    @media (max-width: 480px) {
      .modal-backdrop {
        padding: 0;
        align-items: flex-end;
      }

      .modal-container {
        border-radius: 1.25rem 1.25rem 0 0;
        max-height: 92vh;
        max-width: 100% !important;
        width: 100%;
      }

      .modal-header {
        padding: 1rem 1.15rem;
      }

      .modal-body {
        padding: 1.15rem;
      }

      .modal-footer {
        padding: 0.85rem 1.15rem;
        flex-direction: column-reverse;
        gap: 0.55rem;
      }

      .modal-footer > * {
        width: 100%;
      }
    }

    /* ── prefers-reduced-motion ──────────────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .modal-backdrop { animation: none; }
      .modal-container { animation: none; }
    }
  `]
})
export class ModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = true;
  @Input() title = '';
  @Input() icon?: string;
  @Input() size: ModalSize = 'xl';
  @Input() type: ModalType = 'default';
  @Input() closeOnBackdrop = true;
  @Input() showCloseBtn = true;
  @Input() hasFooter = false;

  @Output() close = new EventEmitter<void>();

  ngOnInit(): void {
    if (this.isOpen) {
      this.lockScroll();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.lockScroll();
      } else {
        this.unlockScroll();
      }
    }
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event?: any): void {
    if (this.isOpen) {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      this.close.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.closeOnBackdrop && (event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }

  private lockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }
}
