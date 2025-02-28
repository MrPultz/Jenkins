import { Component } from '@angular/core';
import {MatToolbar} from "@angular/material/toolbar";
import {MatAnchor} from "@angular/material/button";

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    MatToolbar,
    MatAnchor
  ],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {

}
