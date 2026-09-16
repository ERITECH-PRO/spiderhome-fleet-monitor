import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormGroup, FormControl, Validators
} from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { Site } from '../../../services/site.service';
import { Customer } from '../../../services/customer.service';

@Component({
  selector: 'app-site-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, ButtonComponent, IconComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="siteToEdit ? 'Modifier le site' : 'Nouveau site d’installation'"
      icon="📍"
      size="xl"
      [hasFooter]="true"
      (close)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" id="siteReactiveForm">
        <!-- Bannière d'erreur globale -->
        <div class="popup-banner-error" *ngIf="backendErrors['global']">
          <app-icon name="warning" [size]="16" class="banner-icon"></app-icon>
          <span>{{ backendErrors['global'] }}</span>
        </div>

        <div class="popup-form-grid">
          <!-- Client rattaché -->
          <div class="popup-field form-col-full">
            <label class="popup-label">
              Client rattaché <span class="required">*</span>
            </label>
            <select
              class="popup-select"
              formControlName="customer_id"
              [class.error]="hasError('customer_id')"
            >
              <option [value]="null">— Sélectionner un client —</option>
              <option *ngFor="let c of customers" [value]="c.id">
                {{ c.name }}
              </option>
            </select>
            <span class="popup-error-text" *ngIf="hasError('customer_id')">
              <app-icon name="warning" [size]="13"></app-icon>
              <span>{{ getErrorMessage('customer_id', 'Le client est obligatoire.') }}</span>
            </span>
          </div>

          <!-- Nom du site -->
          <div class="popup-field form-col-full">
            <label class="popup-label">
              Nom du site <span class="required">*</span>
            </label>
            <input
              type="text"
              class="popup-input"
              formControlName="name"
              placeholder="Ex: Bâtiment Principal — RDC"
              [class.error]="hasError('name')"
            />
            <span class="popup-error-text" *ngIf="hasError('name')">
              <app-icon name="warning" [size]="13"></app-icon>
              <span>{{ getErrorMessage('name', 'Le nom du site est obligatoire.') }}</span>
            </span>
          </div>

          <!-- Adresse postale -->
          <div class="popup-field form-col-full">
            <label class="popup-label">Adresse de l'installation</label>
            <input
              type="text"
              class="popup-input"
              formControlName="address"
              placeholder="15 Rue de l'Usine, Lyon"
            />
          </div>

          <!-- Fuseau horaire -->
          <div class="popup-field">
            <label class="popup-label">Fuseau horaire</label>
            <input
              type="text"
              class="popup-input mono"
              formControlName="timezone"
              placeholder="Europe/Paris"
            />
          </div>

          <!-- Nom du contact -->
          <div class="popup-field">
            <label class="popup-label">Nom du contact sur place</label>
            <input
              type="text"
              class="popup-input"
              formControlName="contact_name"
              placeholder="M. Jean Dupont"
            />
          </div>

          <!-- Téléphone du contact -->
          <div class="popup-field form-col-full">
            <label class="popup-label">Téléphone du contact</label>
            <input
              type="text"
              class="popup-input mono"
              formControlName="contact_phone"
              placeholder="+33 6 12 34 56 78"
            />
          </div>
        </div>
      </form>

      <!-- Footer Actions -->
      <div modal-footer class="popup-footer-actions">
        <app-button
          variant="secondary"
          size="md"
          [disabled]="isSaving"
          (btnClick)="onClose()"
        >
          Annuler
        </app-button>
        <app-button
          variant="primary"
          size="md"
          type="submit"
          [isLoading]="isSaving"
          [disabled]="isSaving"
          (btnClick)="onSubmit()"
        >
          {{ isSaving ? 'Enregistrement…' : (siteToEdit ? 'Mettre à jour' : 'Créer le site') }}
        </app-button>
      </div>
    </app-modal>
  `
})
export class SiteFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() siteToEdit?: Site | null = null;
  @Input() customers: Customer[] = [];
  @Input() isSaving = false;
  @Input() backendErrors: Record<string, string[]> = {};

  @Output() formSubmit = new EventEmitter<Partial<Site>>();
  @Output() close = new EventEmitter<void>();

  form: FormGroup = new FormGroup({
    customer_id: new FormControl<number | null>(null, [Validators.required]),
    name: new FormControl<string>('', [Validators.required, Validators.maxLength(255)]),
    address: new FormControl<string>(''),
    timezone: new FormControl<string>('Europe/Paris'),
    contact_name: new FormControl<string>(''),
    contact_phone: new FormControl<string>('')
  });

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.syncForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['siteToEdit'] || (changes['isOpen'] && this.isOpen) || changes['isSaving'] || changes['backendErrors']) {
      this.syncForm();
      this.cdr.markForCheck();
    }
  }

  private syncForm(): void {
    if (this.siteToEdit) {
      this.form.patchValue({
        customer_id: this.siteToEdit.customer_id,
        name: this.siteToEdit.name,
        address: this.siteToEdit.address || '',
        timezone: this.siteToEdit.timezone || 'Europe/Paris',
        contact_name: this.siteToEdit.contact_name || '',
        contact_phone: this.siteToEdit.contact_phone || ''
      });
    } else {
      this.form.reset({
        customer_id: null,
        name: '',
        address: '',
        timezone: 'Europe/Paris',
        contact_name: '',
        contact_phone: ''
      });
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.cdr.markForCheck();
  }

  hasError(controlName: string): boolean {
    const ctrl = this.form.get(controlName);
    const hasFrontError = !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
    const hasBackError = !!(this.backendErrors && this.backendErrors[controlName]?.length);
    return hasFrontError || hasBackError;
  }

  getErrorMessage(controlName: string, defaultMsg: string): string {
    if (this.backendErrors && this.backendErrors[controlName]?.length) {
      return this.backendErrors[controlName][0];
    }
    return defaultMsg;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }
    this.formSubmit.emit(this.form.value);
  }

  onClose(): void {
    this.close.emit();
  }
}
