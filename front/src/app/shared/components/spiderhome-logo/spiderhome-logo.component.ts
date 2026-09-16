import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LogoVariant = 'full' | 'icon-only' | 'stacked' | 'compact';
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | number;

@Component({
  selector: 'app-spiderhome-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="spiderhome-logo-root"
      [class.variant-full]="variant === 'full'"
      [class.variant-icon-only]="variant === 'icon-only'"
      [class.variant-stacked]="variant === 'stacked'"
      [class.variant-compact]="variant === 'compact'"
      [style.--logo-size]="pxSize"
      [attr.aria-label]="altText"
      role="img"
    >
      <!-- ── OFFICIAL SPIDERHOME BRAND SYMBOL ASSET ─────────────────────── -->
      <div class="logo-symbol-wrap" [style.width]="pxSize" [style.height]="pxSize">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%" class="logo-img">
          <!-- Fond bleu nuit très sombre -->
          <rect width="100%" height="100%" fill="#0a1128" />

          <!-- Center alignment offset -->
          <g transform="translate(40, 30)">
              <!-- House Outline -->
              <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 20 140 L 130 50 L 260 50 L 330 80" />
              <rect fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" x="75" y="30" width="25" height="50" />
              
              <!-- Top Left Smart Icon -->
              <path d="M 155 60 L 175 60 A 10 10 0 0 1 185 70 L 185 80 L 155 80 Z" fill="#ff3b5c" />
              <path d="M 190 60 L 210 60 A 10 10 0 0 1 220 70 L 220 80 L 190 80 Z" fill="#00bfff" />
              <path d="M 155 85 L 185 85 L 185 115 A 10 10 0 0 1 175 125 L 155 125 Z" fill="#ffffff" />
              
              <!-- Right Wifi & Camera Icons -->
              <path fill="none" stroke="#00bfff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" d="M 330 80 A 40 40 0 0 1 350 40" />
              <path fill="none" stroke="#00bfff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" d="M 350 100 A 50 50 0 0 1 380 50" />
              <rect x="375" y="85" width="45" height="20" rx="10" fill="#00bfff" />
              <circle cx="388" cy="95" r="4" fill="#ffffff" />
              
              <!-- Typograpghy -->
              <text x="320" y="145" fill="#ffffff" font-family="'Inter', 'Segoe UI', sans-serif" font-size="42px" font-weight="800">HOME</text>
              <g transform="translate(370, 160)">
                  <text x="0" y="0" fill="#ffffff" font-family="'Inter', 'Segoe UI', sans-serif" font-size="38px" font-weight="800" letter-spacing="6px" transform="rotate(90)">SPIDER</text>
              </g>
              
              <!-- Middle section: The Spider Circuit -->
              <g transform="translate(30, 20)">
                  <!-- Top nodes -->
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 125 150 L 125 90" />
                  <circle cx="125" cy="90" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 235 150 L 235 90" />
                  <circle cx="235" cy="90" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  
                  <!-- Center Red Lightbulb -->
                  <path fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M 160 140 A 20 20 0 1 1 200 140 L 200 160 L 160 160 Z" />
                  <line fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" x1="165" y1="165" x2="195" y2="165" />
                  <line fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" x1="170" y1="170" x2="190" y2="170" />
                  <path fill="none" stroke="#ff3b5c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M 170 145 L 180 120 L 190 145" />
                  
                  <!-- Radial red strokes around bulb -->
                  <line fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" x1="180" y1="95" x2="180" y2="110" />
                  <line fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" x1="145" y1="110" x2="155" y2="120" />
                  <line fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" x1="215" y1="110" x2="205" y2="120" />
                  <line fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" x1="135" y1="140" x2="150" y2="140" />
                  <line fill="none" stroke="#ff3b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" x1="225" y1="140" x2="210" y2="140" />
                  
                  <!-- Hexagonal/Circular Core -->
                  <circle cx="180" cy="220" r="35" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
                  <circle cx="180" cy="220" r="20" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 6" />
                  <circle cx="180" cy="220" r="6" fill="#ffffff" />
                  <line fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" x1="180" y1="175" x2="180" y2="185" />
                  <line fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" x1="180" y1="255" x2="180" y2="295" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 120 250 A 65 65 0 0 0 240 250" />
                  
                  <!-- Bottom CPU -->
                  <circle cx="180" cy="330" r="35" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
                  <rect x="165" y="315" width="30" height="30" fill="none" stroke="#00bfff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
                  <!-- CPU Pins -->
                  <path fill="none" stroke="#00bfff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M 170 310 v 5 M 180 310 v 5 M 190 310 v 5" />
                  <path fill="none" stroke="#00bfff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M 170 345 v 5 M 180 345 v 5 M 190 345 v 5" />
                  <path fill="none" stroke="#00bfff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M 160 320 h 5 M 160 330 h 5 M 160 340 h 5" />
                  <path fill="none" stroke="#00bfff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M 195 320 h 5 M 195 330 h 5 M 195 340 h 5" />
                  
                  <!-- Legs Left Side -->
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 140 150 L 90 150 L 90 100" />
                  <circle cx="90" cy="100" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 125 180 L 80 180 L 50 210" />
                  <circle cx="50" cy="210" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 110 210 L 70 230 L 70 280" />
                  <circle cx="70" cy="280" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 100 240 L 40 260 L 20 310" />
                  <circle cx="20" cy="310" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  
                  <!-- Legs Right Side -->
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 220 150 L 270 150 L 270 100" />
                  <circle cx="270" cy="100" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 235 180 L 280 180 L 310 210" />
                  <circle cx="310" cy="210" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 250 210 L 290 230 L 290 280" />
                  <circle cx="290" cy="280" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
                  <path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M 260 240 L 320 260 L 340 310" />
                  <circle cx="340" cy="310" r="8" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
              </g>
          </g>
        </svg>
      </div>

      <!-- ── OFFICIAL SPIDERHOME TYPOGRAPHY (EXACTLY SpiderHome) ───────── -->
      <div *ngIf="variant !== 'icon-only'" class="logo-text-group">
        <span class="brand-text" [style.color]="textColor || 'currentColor'">SpiderHome</span>
        <span *ngIf="showTagline" class="tagline-text">Fleet Manager</span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      line-height: 1;
      vertical-align: middle;
    }

    .spiderhome-logo-root {
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
      user-select: none;
      transition: opacity 0.2s ease, transform 0.2s ease;

      &.variant-stacked {
        flex-direction: column;
        text-align: center;
        gap: 0.5rem;
      }

      &.variant-compact {
        gap: 0.45rem;
      }
    }

    .logo-symbol-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 8px;
      position: relative;
    }

    .logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      transition: transform 0.25s ease;
    }

    .spiderhome-logo-root:hover .logo-img {
      transform: scale(1.04);
    }

    .logo-text-group {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.12rem;
    }

    .brand-text {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 800;
      letter-spacing: -0.03em;
      font-size: calc(var(--logo-size, 34px) * 0.68);
      line-height: 1;
      white-space: nowrap;
    }

    .tagline-text {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: calc(var(--logo-size, 34px) * 0.30);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.72;
      white-space: nowrap;
    }
  `]
})
export class SpiderHomeLogoComponent {
  @Input() variant: LogoVariant = 'full';
  @Input() size: LogoSize = 'md';
  @Input() showTagline = false;
  @Input() color = 'currentColor';
  @Input() textColor?: string;
  @Input() altText = 'SpiderHome';

  get pxSize(): string {
    if (typeof this.size === 'number') {
      return `${this.size}px`;
    }
    switch (this.size) {
      case 'sm': return '28px';
      case 'md': return '36px';
      case 'lg': return '64px';
      case 'xl': return '96px';
      default: return this.size || '36px';
    }
  }
}

