import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'spiderhome_theme';
  private themeSubject: BehaviorSubject<AppTheme>;
  public theme$: Observable<AppTheme>;

  constructor() {
    const savedTheme = this.getSavedTheme();
    this.themeSubject = new BehaviorSubject<AppTheme>(savedTheme);
    this.theme$ = this.themeSubject.asObservable();
    this.applyTheme(savedTheme);
  }

  /** Current active theme */
  get currentTheme(): AppTheme {
    return this.themeSubject.value;
  }

  /** Check if dark mode is active */
  get isDark(): boolean {
    return this.currentTheme === 'dark';
  }

  /** Toggle between dark and light themes */
  toggleTheme(): void {
    const newTheme: AppTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /** Set a specific theme and persist */
  setTheme(theme: AppTheme): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch {
      // safe fallback if storage access is restricted
    }
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  /** Apply data-theme attribute and CSS class on document */
  private applyTheme(theme: AppTheme): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    if (theme === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
  }

  /** Retrieve saved preference or default to dark */
  private getSavedTheme(): AppTheme {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) as AppTheme;
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'dark';
  }
}
