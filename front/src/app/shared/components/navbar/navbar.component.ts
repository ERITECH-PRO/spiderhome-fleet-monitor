import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal.component';
import { DataPreloadService } from '../../../services/data-preload.service';
import { ThemeService } from '../../../services/theme.service';

import { SpiderHomeLogoComponent } from '../spiderhome-logo/spiderhome-logo.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent, ConfirmModalComponent, SpiderHomeLogoComponent],
  template: `
    <nav class="navbar">
      <div class="navbar-inner">
        <!-- Brand Logo & Name -->
        <a class="brand" routerLink="/dashboard" (mouseenter)="prefetchAll()">
          <app-spiderhome-logo variant="full" size="md" [showTagline]="true"></app-spiderhome-logo>
        </a>

        <!-- Navigation Links with SVG Icons -->
        <div class="nav-links">
          <a class="nav-link" routerLink="/dashboard"
             routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}"
             (mouseenter)="prefetchAll()" title="Tableau de bord">
            <app-icon name="dashboard" [size]="17" class="nav-svg"></app-icon>
            <span>Dashboard</span>
          </a>
          <a class="nav-link" routerLink="/customers"
             routerLinkActive="active"
             (mouseenter)="prefetchAll()" title="Registre clients">
            <app-icon name="customers" [size]="17" class="nav-svg"></app-icon>
            <span>Clients</span>
          </a>
          <a class="nav-link" routerLink="/sites"
             routerLinkActive="active"
             (mouseenter)="prefetchAll()" title="Sites & emplacements">
            <app-icon name="sites" [size]="17" class="nav-svg"></app-icon>
            <span>Sites</span>
          </a>
          <a class="nav-link" routerLink="/devices"
             routerLinkActive="active"
             (mouseenter)="prefetchAll()" title="Modules IoT">
            <app-icon name="signal" [size]="17" class="nav-svg"></app-icon>
            <span>Modules</span>
          </a>
          <a class="nav-link" routerLink="/events"
             routerLinkActive="active"
             title="Evenements et Sante">
            <app-icon name="warning" [size]="17" class="nav-svg"></app-icon>
            <span>Evenements</span>
          </a>
          <a class="nav-link" routerLink="/interventions"
             routerLinkActive="active"
             (mouseenter)="prefetchAll()" title="Demandes d'intervention & SAV">
            <app-icon name="wrench" [size]="17" class="nav-svg"></app-icon>
            <span>Interventions</span>
          </a>
        </div>

        <!-- Right Side: Theme Toggle, User Status & Logout -->
        <div class="nav-right">
          <!-- ☀️ / 🌙 Theme Mode Toggle -->
          <button
            type="button"
            class="theme-toggle-btn"
            (click)="theme.toggleTheme()"
            [attr.aria-label]="(theme.theme$ | async) === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'"
            [title]="(theme.theme$ | async) === 'dark' ? 'Activer le Mode Clair (☀️)' : 'Activer le Mode Sombre (🌙)'"
          >
            <app-icon
              [name]="(theme.theme$ | async) === 'dark' ? 'sun' : 'moon'"
              [size]="17"
              class="theme-icon"
            ></app-icon>
          </button>

          <div class="user-pill" *ngIf="auth.currentUser$ | async as user">
            <span class="user-dot"></span>
            <span class="user-name">{{ user.name ? user.name : 'Admin SpiderHome' }}</span>
          </div>

          <!-- Compact Icon Logout Button -->
          <button
            type="button"
            class="logout-btn"
            (click)="promptLogout()"
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <app-icon name="logout" [size]="17"></app-icon>
          </button>
        </div>
      </div>
    </nav>

    <!-- Modal de confirmation de déconnexion -->
    <app-confirm-modal
      [isOpen]="showLogoutModal"
      title="Déconnexion"
      message="Êtes-vous sûr de vouloir vous déconnecter de votre session SpiderHome ?"
      subMessage="Vous devrez renseigner vos identifiants pour accéder à nouveau à la plateforme."
      confirmText="Se déconnecter"
      cancelText="Rester connecté"
      type="warning"
      (confirm)="confirmLogout()"
      (cancel)="showLogoutModal = false"
    ></app-confirm-modal>
  `,
  styles: [`
    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(8, 12, 28, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-bottom: 1px solid rgba(140, 165, 255, 0.12);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
      transition: background-color 0.25s ease, border-color 0.25s ease;
    }

    .navbar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      max-width: 1600px;
      margin: 0 auto;
      padding: 0 1.25rem;
      height: 60px;
      min-width: 0;
    }

    /* ── Brand Logo ─────────────────────────────────────────────────────────── */
    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      user-select: none;
      flex-shrink: 0;
      transition: transform 0.15s ease;
    }
    .brand:hover {
      transform: translateY(-1px);
    }

    .brand-logo-wrap {
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      border-radius: 9px;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.35), rgba(59, 130, 246, 0.22));
      border: 1px solid rgba(99, 102, 241, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 14px rgba(99, 102, 241, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      transition: all 0.2s ease;
    }
    .brand:hover .brand-logo-wrap {
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }

    .brand-svg {
      color: #818cf8;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 0 6px rgba(129, 140, 248, 0.6));
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 0.02rem;
    }

    .brand-name {
      font-size: 0.95rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      white-space: nowrap;
      line-height: 1.1;
    }

    .brand-sub {
      font-size: 0.65rem;
      color: #94a3b8;
      font-weight: 500;
      letter-spacing: 0.02em;
      white-space: nowrap;
      line-height: 1.1;
    }

    /* ── Navigation Tabs ────────────────────────────────────────────────────── */
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex: 1;
      justify-content: center;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding: 0.2rem 0;
    }
    .nav-links::-webkit-scrollbar {
      display: none;
    }

    .nav-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.38rem 0.65rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
      color: #94a3b8;
      text-decoration: none;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid transparent;
    }

    .nav-link span {
      white-space: nowrap;
    }

    .nav-link:hover {
      color: #ffffff;
      background: rgba(148, 163, 184, 0.08);
      border-color: rgba(148, 163, 184, 0.15);
      transform: translateY(-1px);
    }

    .nav-link.active {
      color: #ffffff;
      font-weight: 600;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.45), rgba(59, 130, 246, 0.32));
      border: 1px solid rgba(99, 102, 241, 0.65);
      box-shadow: 0 0 14px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .nav-svg {
      display: flex;
      flex-shrink: 0;
      transition: color 0.18s ease;
    }

    /* ── Right Meta ─────────────────────────────────────────────────────────── */
    .nav-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    /* ── Theme Toggle Button (Circular) ────────────────────────────────────── */
    .theme-toggle-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #94a3b8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      outline: none;
      flex-shrink: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .theme-toggle-btn:hover {
      color: #ffffff;
      border-color: rgba(99, 102, 241, 0.5);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.35);
      transform: rotate(15deg) scale(1.05);
    }

    .theme-toggle-btn:active {
      transform: scale(0.95);
    }

    .theme-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s ease;
    }

    /* ── User Pill ──────────────────────────────────────────────────────────── */
    .user-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.22);
      font-size: 0.78rem;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      flex-shrink: 0;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .user-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
    }

    .user-name {
      font-weight: 600;
      white-space: nowrap;
    }

    /* ── Logout Button (Rounded Square Icon) ────────────────────────────────── */
    .logout-btn {
      width: 32px;
      height: 32px;
      border-radius: 0.5rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #94a3b8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      outline: none;
      flex-shrink: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .logout-btn:hover {
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.1);
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.25);
      transform: translateY(-1px);
    }

    .logout-btn:active {
      transform: scale(0.95);
    }

    /* ── Responsive Scaling ─────────────────────────────────────────────────── */
    @media (max-width: 1400px) {
      .navbar-inner { padding: 0 1rem; gap: 0.5rem; }
      .nav-link { padding: 0.35rem 0.55rem; font-size: 0.77rem; gap: 0.3rem; }
      .brand-sub { display: none; }
    }

    @media (max-width: 1200px) {
      .brand-text { display: none; }
      .nav-link { padding: 0.32rem 0.5rem; font-size: 0.75rem; }
      .user-pill { padding: 0.3rem 0.65rem; font-size: 0.72rem; }
    }

    @media (max-width: 992px) {
      .nav-links { justify-content: flex-start; }
      .user-pill { display: none; }
    }

    @media (max-width: 768px) {
      .navbar-inner { padding: 0 0.5rem; }
      .nav-link span { display: none; }
      .nav-link { padding: 0.4rem 0.5rem; border-radius: 0.5rem; }
    }
  `]
})
export class NavbarComponent {
  showLogoutModal = false;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private preloadService: DataPreloadService
  ) {
    this.preloadAll();
  }

  promptLogout() {
    this.showLogoutModal = true;
  }

  confirmLogout() {
    this.showLogoutModal = false;
    this.auth.logout();
  }

  logout() {
    this.promptLogout();
  }

  preloadAll() {
    this.preloadService.preloadAll();
  }

  prefetchAll() {
    this.preloadService.preloadAll();
  }
}
