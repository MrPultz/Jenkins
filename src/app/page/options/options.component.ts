import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-options',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './options.component.html',
  styleUrl: './options.component.css'
})
export class OptionsComponent  implements OnInit {
  showPreviewOptions = true;
  usePreviewMode = true;
  previewCount = 4;
  showSavedMessage = false;

  constructor(
    private settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Load current settings
    this.settingsService.getShowPreviewOptions().subscribe(value => {
      this.showPreviewOptions = value;
    });

    this.settingsService.getUsePreviewMode().subscribe(value => {
      this.usePreviewMode = value;
    });

    this.settingsService.getPreviewCount().subscribe(value => {
      this.previewCount = value;
    });
  }

  updateSettings(): void {
    // Update all settings
    this.settingsService.setShowPreviewOptions(this.showPreviewOptions);
    this.settingsService.setUsePreviewMode(this.usePreviewMode);
    this.settingsService.setPreviewCount(this.previewCount);

    // Show saved message
    this.showSavedMessage = true;
    setTimeout(() => {
      this.showSavedMessage = false;
    }, 2000);
  }

  navigateToMain(): void {
    this.router.navigate(['/']);
  }

}
