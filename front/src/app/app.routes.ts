import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './auth/login.component';
import { CustomersComponent } from './customers/customers.component';
import { SitesComponent } from './sites/sites.component';
import { DevicesComponent } from './devices/devices.component';
import { InterventionsComponent } from './interventions/interventions.component';
import { EventsComponent } from './events/events.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'customers', component: CustomersComponent },
      { path: 'sites', component: SitesComponent },
      { path: 'device-models', redirectTo: 'devices', pathMatch: 'full' },
      { path: 'devices', component: DevicesComponent },
      { path: 'events', component: EventsComponent },
      { path: 'interventions', component: InterventionsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
