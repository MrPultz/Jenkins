import { Routes } from '@angular/router';
import { HomeComponent } from './page/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {path: '', component: HomeComponent, canActivate: [AuthGuard]},
  { path: 'login', component: LoginComponent },
  // Apply AuthGuard to all protected routes
  { path: '**', redirectTo: '' }

];
