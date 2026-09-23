import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './auth/login.component';
import { CustomersComponent } from './customers/customers.component';
import { SitesComponent } from './sites/sites.component';
import { DevicesComponent } from './devices/devices.component';
import { InterventionsComponent } from './interventions/interventions.component';
import { EventsComponent } from './events/events.component';
import { IncidentsComponent } from './incidents/incidents.component';
import { ProfileComponent } from './profile/profile.component';
import { UsersComponent } from './users/users.component';
import { AuditComponent } from './audit/audit.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

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
      { path: 'incidents', component: IncidentsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'interventions', component: InterventionsComponent },
      { path: 'users', component: UsersComponent, canActivate: [roleGuard(['admin'])] },
      { path: 'audit', component: AuditComponent, canActivate: [roleGuard(['admin', 'support', 'quality'])] },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
