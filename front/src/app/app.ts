import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthService } from './services/auth.service';
import { DataPreloadService } from './services/data-preload.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent],
  template: `
    <app-navbar *ngIf="auth.isLoggedIn()"></app-navbar>
    <main [class.with-nav]="auth.isLoggedIn()">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    main { min-height: 100dvh; }
    main.with-nav { min-height: calc(100dvh - 58px); }
  `]
})
export class App implements OnInit {
  constructor(
    public auth: AuthService,
    private preloadService: DataPreloadService
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.preloadService.preloadAll();
    }
  }
}
