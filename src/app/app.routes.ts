import { Routes } from '@angular/router';
import { HomeComponent } from './page/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './guards/auth.guard';
import {ChatComponent} from "./page/chat/chat.component";

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [AuthGuard]},
  { path: 'login', component: LoginComponent },
  { path: 'chat', component: ChatComponent, canActivate: [AuthGuard]},
  // Apply AuthGuard to all protected routes
  { path: '**', redirectTo: '' }

];
