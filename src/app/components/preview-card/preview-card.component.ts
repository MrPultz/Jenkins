import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PreviewDesign } from '../../services/preview-generator.service';

@Component({
  selector: 'app-preview-card',
  standalone: true,
  imports: [],
  templateUrl: './preview-card.component.html',
  styleUrl: './preview-card.component.css'
})
export class PreviewCardComponent {
   @Input() design!: PreviewDesign;
   @Input() isSelected: boolean = false;
   @Output() selectDesign = new EventEmitter<string>();


   onSelect(): void {
      this.selectDesign.emit(this.design.id);
   }

  getDesignNumber(id: any): string {
    if (typeof id === 'number') return id.toString();
    if (typeof id === 'string' && id.includes('_')) return id.split('_')[1];
    return id.toString();
  }

}
