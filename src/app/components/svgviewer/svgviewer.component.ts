import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {DomSanitizer} from "@angular/platform-browser";
import { SafeHtmlPipe} from "../../pipes/safe-html.pipe";

@Component({
  selector: 'app-svgviewer',
  standalone: true,
  imports: [
    SafeHtmlPipe,
    NgForOf,
    NgClass,
    NgIf
  ],
  templateUrl: './svgviewer.component.html',
  styleUrl: './svgviewer.component.css'
})
export class SvgviewerComponent implements OnChanges {
  @Input() svgCodes: { id: number, code: string, name: string }[] = [];
  @Input() selectedIndex: number = 0;
  @Output() selectSvg = new EventEmitter<number>();
  @Output() clickSvg = new EventEmitter<number>();

  svgContent: string = '';

  processedSvgs: string[] = [];

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges) {
    if(changes['svgCodes'] && changes['svgCodes'].currentValue) {
      this.processedSvgs = this.svgCodes.map(item => this.processSvgCode(item.code))
    }
  }

  onSvgSelect(index: number): void {
    this.selectSvg.emit(index);
  }

  onSvgClick(index: number): void {
    this.clickSvg.emit(index);
  }

  processSvgCode(code: string): string {
    if(code.includes('<svg') && code.includes('</svg>')) {
      return code;
    } else {
      // If it's just SVG paths or elements without the svg tag, wrap it
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${code}</svg>`;
    }
  }

  downloadSvg(): void {
    if (this.processedSvgs.length === 0) return;

    const svgToDownload = this.processedSvgs[this.selectedIndex];
    const blob = new Blob([svgToDownload], { type: 'image/svg+xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svg-design-${this.selectedIndex + 1}.svg`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
