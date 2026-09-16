import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Unified SVG Icon Component
 * Single source of truth for all icons across the application.
 * Uses Heroicons v2 outline style for maximum consistency.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      [attr.viewBox]="viewBox"
      fill="none"
      [attr.stroke]="color"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [attr.class]="cssClass"
    >
      <ng-container [ngSwitch]="name">

        <!-- ── BRAND / LOGO (OFFICIAL SPIDERHOME SYMBOL) ──────────── -->
        <ng-container *ngSwitchCase="'spider'">
          <!-- Legs -->
          <path d="M8.8 9.1L5.7 6l3.9-3.6M9.3 7.9L7.2 4.8 10.8 1.7M14.7 7.9l2.1-3.1-3.6-3.1M15.2 9.1l3.1-3.1-3.9-3.6"/>
          <path d="M8.8 11.3L5.3 13.4l6.5 7.7M9.3 12.5l-2.1 2.9L12 22.3M15.2 11.3l3.5 2.1-6.5 7.7M14.7 12.5l2.1 2.9-4.8 6.9"/>
          <!-- House body -->
          <path d="M12 7.2L8.6 9.6v2.2h6.8V9.6Z" fill="currentColor"/>
          <!-- Abdomen V point -->
          <path d="M8.6 11.8l3.4 2.1 3.4-2.1Z" fill="currentColor"/>
          <!-- Windows -->
          <rect x="10.1" y="9.8" width="1.5" height="1.5" rx="0.3" fill="var(--logo-window-bg, #ffffff)"/>
          <rect x="12.4" y="9.8" width="1.5" height="1.5" rx="0.3" fill="var(--logo-window-bg, #ffffff)"/>
          <rect x="10.1" y="11.6" width="1.5" height="1.5" rx="0.3" fill="var(--logo-window-bg, #ffffff)"/>
          <rect x="12.4" y="11.6" width="1.5" height="1.5" rx="0.3" fill="var(--logo-window-bg, #ffffff)"/>
        </ng-container>

        <!-- ── ACTIONS ───────────────────────────────────────────────── -->
        <!-- plus / add -->
        <ng-container *ngSwitchCase="'plus'">
          <path d="M12 4.5v15m7.5-7.5h-15"/>
        </ng-container>

        <!-- pencil / edit -->
        <ng-container *ngSwitchCase="'pencil'">
          <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/>
        </ng-container>

        <!-- trash / delete -->
        <ng-container *ngSwitchCase="'trash'">
          <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
        </ng-container>

        <!-- external-link / open in new tab -->
        <ng-container *ngSwitchCase="'external-link'">
          <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
        </ng-container>

        <!-- eye / view -->
        <ng-container *ngSwitchCase="'eye'">
          <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
        </ng-container>

        <!-- eye-off / hide password -->
        <ng-container *ngSwitchCase="'eye-off'">
          <path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/>
        </ng-container>


        <!-- heart-pulse / diagnostic -->
        <ng-container *ngSwitchCase="'heart-pulse'">
          <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/>
          <path d="M3.75 13.5h3l1.5-6 3 9 1.5-6h3"/>
        </ng-container>

        <!-- magnifying-glass / search -->
        <ng-container *ngSwitchCase="'search'">
          <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
        </ng-container>

        <!-- funnel / filter -->
        <ng-container *ngSwitchCase="'filter'">
          <path d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/>
        </ng-container>

        <!-- arrow-left / back -->
        <ng-container *ngSwitchCase="'arrow-left'">
          <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>
        </ng-container>

        <!-- arrow-right -->
        <ng-container *ngSwitchCase="'arrow-right'">
          <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/>
        </ng-container>

        <!-- x-mark / close -->
        <ng-container *ngSwitchCase="'x'">
          <path d="M6 18 18 6M6 6l12 12"/>
        </ng-container>

        <!-- check / confirm -->
        <ng-container *ngSwitchCase="'check'">
          <path d="m4.5 12.75 6 6 9-13.5"/>
        </ng-container>

        <!-- cog / settings -->
        <ng-container *ngSwitchCase="'cog'">
          <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
        </ng-container>

        <!-- lock / logout -->
        <ng-container *ngSwitchCase="'lock'">
          <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>
        </ng-container>

        <!-- arrow-right-on-rectangle / logout -->
        <ng-container *ngSwitchCase="'logout'">
          <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"/>
        </ng-container>

        <!-- ── NAVIGATION ────────────────────────────────────────────── -->
        <!-- squares / dashboard -->
        <ng-container *ngSwitchCase="'dashboard'">
          <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/>
        </ng-container>

        <!-- building-office / customers -->
        <ng-container *ngSwitchCase="'customers'">
          <path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>
        </ng-container>

        <!-- map-pin / sites -->
        <ng-container *ngSwitchCase="'sites'">
          <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
        </ng-container>

        <!-- cpu-chip / devices & models -->
        <ng-container *ngSwitchCase="'devices'">
          <path d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"/>
        </ng-container>

        <!-- wrench-screwdriver / models -->
        <ng-container *ngSwitchCase="'models'">
          <path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"/>
        </ng-container>

        <!-- ── STATUS / UI ────────────────────────────────────────────── -->
        <!-- chevron-left -->
        <ng-container *ngSwitchCase="'chevron-left'">
          <path d="M15.75 19.5 8.25 12l7.5-7.5"/>
        </ng-container>

        <!-- chevron-right -->
        <ng-container *ngSwitchCase="'chevron-right'">
          <path d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
        </ng-container>

        <!-- chevron-double-left (first page) -->
        <ng-container *ngSwitchCase="'first-page'">
          <path d="m18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5"/>
        </ng-container>

        <!-- chevron-double-right (last page) -->
        <ng-container *ngSwitchCase="'last-page'">
          <path d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5"/>
        </ng-container>

        <!-- exclamation-triangle / warning -->
        <ng-container *ngSwitchCase="'warning'">
          <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
        </ng-container>

        <!-- information-circle / info -->
        <ng-container *ngSwitchCase="'info'">
          <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/>
        </ng-container>

        <!-- envelope / email -->
        <ng-container *ngSwitchCase="'email'">
          <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
        </ng-container>

        <!-- refresh / reload -->
        <ng-container *ngSwitchCase="'refresh'">
          <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
        </ng-container>

        <!-- signal / broadcast (devices telemetry) -->
        <ng-container *ngSwitchCase="'signal'">
          <path d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.981 0 13.788M12 12h.008v.008H12V12Z"/>
        </ng-container>

        <!-- sun / light mode -->
        <ng-container *ngSwitchCase="'sun'">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2.25v2.25m0 15v2.25M4.75 4.75l1.6 1.6m11.3 11.3 1.6 1.6M2.25 12h2.25m15 0h2.25M6.35 17.65l-1.6 1.6m14.5-14.5-1.6 1.6"/>
        </ng-container>

        <!-- moon / dark mode -->
        <ng-container *ngSwitchCase="'moon'">
          <path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>
        </ng-container>

        <!-- wrench / interventions -->
        <ng-container *ngSwitchCase="'wrench'">
          <path d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.647a2.548 2.548 0 1 1-3.586-3.586l8.647-7.152c.833-.686.995-1.874.904-2.95A4.5 4.5 0 0 1 17.25 2.25l-3.277 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.277Z"/>
        </ng-container>

        <!-- updates / firmware / cloud-arrow-up -->
        <ng-container *ngSwitchCase="'updates'">
          <path d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"/>
        </ng-container>

        <!-- default fallback: small dot -->
        <ng-container *ngSwitchDefault>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        </ng-container>

      </ng-container>
    </svg>
  `
})
export class IconComponent {
  @Input() name = 'info';
  @Input() size = 16;
  @Input() color = 'currentColor';
  @Input() strokeWidth = 1.6;
  @Input() cssClass = '';
  viewBox = '0 0 24 24';
}
