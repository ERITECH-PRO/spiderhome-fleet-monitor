import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'error' | 'success';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, ButtonComponent, IconComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="title"
      [type]="type === 'danger' || type === 'error' ? 'danger' : (type === 'warning' ? 'warning' : (type === 'success' ? 'success' : 'info'))"
      size="md"
      [hasFooter]="true"
      [closeOnBackdrop]="type !== 'danger' || !showCancel"
      (close)="onDismiss()"
    >
      <div class="confirm-body">
        <!-- Icon badge -->
        <div class="confirm-icon-wrap" [ngClass]="'icon-' + (type === 'error' ? 'danger' : type)" aria-hidden="true">
          <app-icon *ngIf="iconName" [name]="iconName" [size]="22" [strokeWidth]="1.8"></app-icon>
          <ng-container *ngIf="!iconName">
            <app-icon *ngIf="(type === 'danger' || type === 'error') && showCancel"  name="trash"   [size]="22" [strokeWidth]="1.8"></app-icon>
            <app-icon *ngIf="(type === 'danger' || type === 'error') && !showCancel" name="warning" [size]="22" [strokeWidth]="1.8"></app-icon>
            <app-icon *ngIf="type === 'warning'" name="warning" [size]="22" [strokeWidth]="1.8"></app-icon>
            <app-icon *ngIf="type === 'info'"    name="info"    [size]="22" [strokeWidth]="1.8"></app-icon>
            <app-icon *ngIf="type === 'success'" name="check"   [size]="22" [strokeWidth]="1.8"></app-icon>
          </ng-container>
        </div>

        <!-- Text content -->
        <div class="confirm-text">
          <p class="confirm-message">{{ message }}</p>
          <p class="confirm-sub" *ngIf="subMessage">{{ subMessage }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div modal-footer class="confirm-actions">
        <app-button
          *ngIf="showCancel"
          variant="secondary"
          size="md"
          [disabled]="loading"
          (btnClick)="cancel.emit()"
        >
          {{ cancelText }}
        </app-button>

        <app-button
          [variant]="type === 'danger' && showCancel ? 'danger' : 'primary'"
          size="md"
          [iconName]="iconName ? iconName : (type === 'danger' && showCancel ? 'trash' : 'check')"
          [isLoading]="loading"
          [disabled]="loading"
          (btnClick)="onConfirm()"
        >
          {{ confirmText }}
        </app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    .confirm-body {
      display: flex;
      align-items: flex-start;
      gap: 1.15rem;
      padding: 0.25rem 0 0.5rem;
    }

    /* Icon badge */
    .confirm-icon-wrap {
      width: 3rem;
      height: 3rem;
      border-radius: 0.875rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon-danger,
    .icon-error {
      background-color: rgba(225, 29, 72, 0.12);
      border: 1px solid rgba(225, 29, 72, 0.3);
      color: #f87171;
    }

    .icon-warning {
      background-color: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
    }

    .icon-info {
      background-color: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
    }

    .icon-success {
      background-color: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    /* Text */
    .confirm-text {
      flex: 1;
      min-width: 0;
      padding-top: 0.15rem;
    }

    .confirm-message {
      margin: 0 0 0.5rem;
      color: var(--heading);
      font-size: 0.925rem;
      font-weight: 600;
      line-height: 1.5;
    }

    .confirm-sub {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.82rem;
      line-height: 1.5;
    }

    /* Footer actions */
    .confirm-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      width: 100%;
    }

    /* Light mode icon adjustments */
    :host-context([data-theme="light"]),
    :host-context(.theme-light) {
      .icon-danger,
      .icon-error   { color: #dc2626; }
      .icon-warning { color: #d97706; }
      .icon-info    { color: #4f46e5; }
      .icon-success { color: #059669; }
    }
  `]
})
export class ConfirmModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Confirmation';
  @Input() message = 'Êtes-vous sûr de vouloir effectuer cette action ?';
  @Input() subMessage?: string = 'Cette action est irréversible.';
  @Input() confirmText = 'Supprimer';
  @Input() cancelText = 'Annuler';
  @Input() type: ConfirmType = 'danger';
  @Input() loading = false;
  @Input() showCancel = true;
  @Input() iconName?: string;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
    if (!this.showCancel) {
      this.cancel.emit();
    }
  }

  onDismiss(): void {
    this.cancel.emit();
  }
}
