import { Component } from '@angular/core';
import {AuthService} from "../../services/auth.service";
import {Router} from "@angular/router";
import {MatCardModule, MatCardContent, MatCardHeader, MatCardTitle} from "@angular/material/card";
import {FormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {NgIf} from "@angular/common";
import {MatInputModule} from "@angular/material/input";
import {MatButtonModule} from "@angular/material/button";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatCardModule,
    MatCardHeader,
    MatCardContent,
    FormsModule,
    MatFormFieldModule,
    MatCardTitle,
    NgIf,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  onLogin(): void {
    this.error = '';
    this.authService.login(this.username, this.password).subscribe({
      next: (success) => {
        if (success) {
          this.router.navigate(['/home']);
        } else {
          this.error = 'Invalid username or password';
        }
      },
      error: (error) => {
        console.error('Error:', error);
      }
    });
  }
}
