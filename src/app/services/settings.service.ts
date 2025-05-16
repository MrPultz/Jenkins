import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private showPreviewOptionsSubject = new BehaviorSubject<boolean>(true);
  private usePreviewModeSubject = new BehaviorSubject<boolean>(true);
  private previewCountSubject = new BehaviorSubject<number>(4);

  constructor() {
    this.loadSettings();
  }

  // Preview options visibility
  getShowPreviewOptions(): Observable<boolean> {
    return this.showPreviewOptionsSubject.asObservable();
  }

  setShowPreviewOptions(value: boolean): void {
    this.showPreviewOptionsSubject.next(value);
    this.saveSettings();
  }

  // Preview mode toggle
  getUsePreviewMode(): Observable<boolean> {
    return this.usePreviewModeSubject.asObservable();
  }

  setUsePreviewMode(value: boolean): void {
    this.usePreviewModeSubject.next(value);
    this.saveSettings();
  }

  // Preview count
  getPreviewCount(): Observable<number> {
    return this.previewCountSubject.asObservable();
  }

  setPreviewCount(value: number): void {
    this.previewCountSubject.next(value);
    this.saveSettings();
  }

  // Save settings to localStorage
  private saveSettings(): void {
    const settings = {
      showPreviewOptions: this.showPreviewOptionsSubject.value,
      usePreviewMode: this.usePreviewModeSubject.value,
      previewCount: this.previewCountSubject.value
    };
    localStorage.setItem('previewSettings', JSON.stringify(settings));
  }

  // Load settings from localStorage
  private loadSettings(): void {
    const savedSettings = localStorage.getItem('previewSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.showPreviewOptions !== undefined) {
          this.showPreviewOptionsSubject.next(settings.showPreviewOptions);
        }
        if (settings.usePreviewMode !== undefined) {
          this.usePreviewModeSubject.next(settings.usePreviewMode);
        }
        if (settings.previewCount !== undefined) {
          this.previewCountSubject.next(settings.previewCount);
        }
      } catch (e) {
        console.error('Failed to parse settings from localStorage', e);
      }
    }
  }
}
