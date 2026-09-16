import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'icon';
export type ButtonSize    = 'sm' | 'md' | 'lg';
export type ButtonType   = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || isLoading"
      [attr.aria-disabled]="disabled || isLoading"
      [attr.aria-busy]="isLoading"
      [attr.aria-label]="ariaLabel || null"
      [attr.title]="tooltip || ariaLabel || null"
      class="btn-root"
      [ngClass]="getClasses()"
      (click)="onClick($event)"
    >
      <!-- Loading Spinner -->
      <svg *ngIf="isLoading"
        class="btn-spinner"
        xmlns="http://www.w3.org/2000/svg"
        fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="spinner-track" cx="12" cy="12" r="10"
          stroke="currentColor" stroke-width="3.5"></circle>
        <path class="spinner-arc" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>

      <!-- SVG Icon (left prefix when variant !== icon, centred when icon) -->
      <app-icon
        *ngIf="iconName && !isLoading"
        [name]="iconName"
        [size]="iconSize"
        class="btn-icon"
        aria-hidden="true"
      ></app-icon>

      <!-- Text content (hidden for pure icon buttons via screen reader only class) -->
      <span class="btn-content" [class.sr-only]="variant === 'icon' && !isLoading">
        <ng-content></ng-content>
      </span>
    </button>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: stretch;
    }

    /* ── Root Button ──────────────────────────────────────────────────────── */
    .btn-root {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      font-family: inherit;
      font-weight: 600;
      letter-spacing: 0.01em;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      border: 1px solid transparent;
      outline: none;
      text-decoration: none;
      position: relative;
      overflow: hidden;
      transition:
        background 0.18s cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1),
        border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.14s cubic-bezier(0.16, 1, 0.3, 1),
        color 0.14s ease,
        opacity 0.14s ease;
      width: 100%;
    }

    .btn-root:focus-visible {
      outline: 2px solid #6366f1;
      outline-offset: 2px;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
    }

    .btn-root:active:not(:disabled) {
      transform: scale(0.965) !important;
    }

    .btn-root:disabled {
      opacity: 0.42;
      cursor: not-allowed;
      pointer-events: none;
      transform: none !important;
      box-shadow: none !important;
    }

    .btn-content {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .btn-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    /* ── Size Variants ────────────────────────────────────────────────────── */
    .size-sm {
      height: 2.1rem;
      padding: 0 0.85rem;
      font-size: 0.78rem;
      border-radius: 0.6rem;
      gap: 0.35rem;
    }
    .size-sm.is-icon {
      padding: 0;
      width: 2.1rem;
      height: 2.1rem;
      border-radius: 0.6rem;
    }

    .size-md {
      height: 2.5rem;
      padding: 0 1.25rem;
      font-size: 0.875rem;
      border-radius: 0.75rem;
      gap: 0.5rem;
    }
    .size-md.is-icon {
      padding: 0;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
    }

    .size-lg {
      height: 2.85rem;
      padding: 0 1.5rem;
      font-size: 0.95rem;
      border-radius: 0.85rem;
      gap: 0.6rem;
    }
    .size-lg.is-icon {
      padding: 0;
      width: 2.85rem;
      height: 2.85rem;
      border-radius: 0.85rem;
    }

    /* ── 1. Primary (SpiderHome Indigo-Cobalt SaaS Gradient) ───────────── */
    .v-primary {
      color: #ffffff;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 55%, #3b82f6 100%);
      border-color: rgba(165, 180, 252, 0.55);
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }
    .v-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 55%, #2563eb 100%);
      border-color: rgba(199, 210, 254, 0.85);
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.55), 0 0 14px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
      transform: translateY(-1.5px);
    }

    /* ── 2. Secondary (Dark glass navy) ──────────────────────────────────── */
    .v-secondary {
      color: #e2e8f0;
      background: rgba(19, 27, 46, 0.85);
      border-color: rgba(51, 65, 85, 0.9);
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    .v-secondary:hover:not(:disabled) {
      color: #ffffff;
      background: rgba(30, 41, 59, 0.98);
      border-color: rgba(99, 102, 241, 0.4);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), 0 0 10px rgba(99, 102, 241, 0.12);
      transform: translateY(-1px);
    }

    /* ── 3. Danger (Crimson) ──────────────────────────────────────────────── */
    .v-danger {
      color: #ffffff;
      background: linear-gradient(135deg, #be123c 0%, #b91c1c 100%);
      border-color: rgba(225, 29, 72, 0.5);
      box-shadow: 0 2px 12px rgba(225, 29, 72, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }
    .v-danger:hover:not(:disabled) {
      background: linear-gradient(135deg, #e11d48 0%, #dc2626 100%);
      border-color: rgba(251, 113, 133, 0.75);
      box-shadow: 0 5px 20px rgba(225, 29, 72, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.18);
      transform: translateY(-1.5px);
    }

    /* ── 4. Success (Emerald) ─────────────────────────────────────────────── */
    .v-success {
      color: #ffffff;
      background: linear-gradient(135deg, #047857 0%, #0f766e 100%);
      border-color: rgba(16, 185, 129, 0.5);
      box-shadow: 0 2px 12px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }
    .v-success:hover:not(:disabled) {
      background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
      border-color: rgba(52, 211, 153, 0.75);
      box-shadow: 0 5px 20px rgba(16, 185, 129, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18);
      transform: translateY(-1.5px);
    }

    /* ── 5. Ghost (Transparent / subtle) ─────────────────────────────────── */
    .v-ghost {
      color: #94a3b8;
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .v-ghost:hover:not(:disabled) {
      color: #f1f5f9;
      background: rgba(30, 41, 59, 0.55);
      border-color: rgba(51, 65, 85, 0.65);
    }

    /* ── 6. Icon (Compact action; centred icon only) ──────────────────────── */
    .v-icon {
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.6);
      border-color: rgba(51, 65, 85, 0.75);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
    }
    .v-icon:hover:not(:disabled) {
      color: #e2e8f0;
      background: rgba(30, 41, 59, 0.95);
      border-color: rgba(99, 102, 241, 0.45);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
      transform: translateY(-1px);
    }

    /* Danger tint on icon button */
    .v-icon.is-danger:hover:not(:disabled) {
      color: #fda4af;
      background: rgba(190, 18, 60, 0.2);
      border-color: rgba(225, 29, 72, 0.5);
      box-shadow: 0 2px 8px rgba(225, 29, 72, 0.2);
    }

    /* Diagnostic / health tint on icon button */
    .v-icon.is-health:hover:not(:disabled) {
      color: #6ee7b7;
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.4);
    }

    /* ── Spinner ──────────────────────────────────────────────────────────── */
    .btn-spinner {
      width: 1em;
      height: 1em;
      animation: btn-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    .spinner-track { opacity: 0.25; }
    .spinner-arc   { opacity: 0.9; }

    /* ── Light Mode Button Overrides ─────────────────────────────────────── */
    :host-context([data-theme="light"]),
    :host-context(.theme-light) {
      .v-secondary {
        color: #334155;
        background: #ffffff;
        border-color: #cbd5e1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .v-secondary:hover:not(:disabled) {
        color: #0f172a;
        background: #f8fafc;
        border-color: rgba(99, 102, 241, 0.5);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
      }

      .v-ghost {
        color: #64748b;
      }
      .v-ghost:hover:not(:disabled) {
        color: #0f172a;
        background: rgba(0, 0, 0, 0.05);
        border-color: rgba(0, 0, 0, 0.08);
      }

      .v-icon {
        color: #64748b;
        background: #ffffff;
        border-color: #cbd5e1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .v-icon:hover:not(:disabled) {
        color: #0f172a;
        background: #f8fafc;
        border-color: rgba(79, 70, 229, 0.45);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .v-icon.is-danger:hover:not(:disabled) {
        color: #dc2626;
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.4);
      }
      .v-icon.is-health:hover:not(:disabled) {
        color: #059669;
        background: rgba(16, 185, 129, 0.1);
        border-color: rgba(16, 185, 129, 0.4);
      }
    }
  `]
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() isLoading = false;
  @Input() disabled = false;
  /** SVG icon name from IconComponent */
  @Input() iconName?: string;
  /** @deprecated Use iconName instead for SVG icons */
  @Input() icon?: string;
  @Input() type: ButtonType = 'button';
  @Input() ariaLabel?: string;
  @Input() tooltip?: string;
  @Input() customClass = '';
  @Input() isDanger = false;
  @Input() isHealth = false;

  /** Computed icon size based on button size */
  get iconSize(): number {
    return this.size === 'sm' ? 14 : this.size === 'lg' ? 18 : 16;
  }

  @HostBinding('style.display') get hostDisplay() {
    return 'inline-flex';
  }

  @Output() btnClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled && !this.isLoading) {
      this.btnClick.emit(event);
    }
  }

  getClasses(): Record<string, boolean> {
    return {
      ['size-' + this.size]: true,
      ['v-' + this.variant]: true,
      'is-icon': this.variant === 'icon',
      'is-danger': this.isDanger,
      'is-health': this.isHealth,
      [this.customClass]: !!this.customClass,
    };
  }
}
