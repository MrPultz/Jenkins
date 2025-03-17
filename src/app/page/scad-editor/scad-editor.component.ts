import { Component } from '@angular/core';
import {ConversionServiceService} from "../../services/conversion-service.service";
import {FormsModule} from "@angular/forms";
import { HttpClientModule } from "@angular/common/http";
import {NgIf} from "@angular/common";

interface PrinterProfile {
  id: string;
  name: string;
}

interface FilamentProfile {
  id: string;
  name: string;
}

interface QualityProfile {
  id: string;
  name: string;
}

@Component({
  selector: 'app-scad-editor',
  standalone: true,
  imports: [
    FormsModule,
    HttpClientModule,
    NgIf
  ],
  templateUrl: './scad-editor.component.html',
  styleUrl: './scad-editor.component.css'
})
export class ScadEditorComponent {
  scadCode = '//Example OPENSCAD code \ncube([10, 20, 30]);';
  isConverting = false;
  error: string | null = null;
  showPrintSettings = false;
  stlFileGenerated = false;
  showStlUpload = false;
  selectedStlFile: File | null = null;

  // Printer profiles
  printerProfiles: PrinterProfile[] = [
    { id: 'ORIGINAL_PRUSA_MK4', name: 'Prusa MK4' },
    { id: 'ORIGINAL_PRUSA_MINI', name: 'Prusa Mini' }
  ];

  // Filament profiles
  filamentProfiles: FilamentProfile[] = [
    { id: 'Prusament PLA', name: 'Prusament PLA' },
    { id: 'Prusament PETG', name: 'Prusament PETG' },
    { id: 'ABS', name: 'ABS' }
  ];

  // Quality profiles
  qualityProfile: QualityProfile[] = [
    { id: '0.15 SPEED', name: '0.15mm SPEED' },
    { id: '0.15 QUALITY', name: '0.15mm STRUCTUAL' },
    { id: '0.2 SPEED', name: '0.2mm SPEED' },
    { id: '0.2 QUALITY', name: '0.2mm STRUCTUAL' }
  ]

  // Support profiles - TODO: Implement support profiles

  // Selected Settings
  selectedPrinterType = 'ORIGINAL_PRUSA_MK4';
  selectedFilamentType = 'Prusament PLA';
  selectedQualityProfile = '0.2 SPEED';

  // Generated files
  generatedStlBlob: Blob | null = null;


  constructor(private conversionService: ConversionServiceService) { }

  togglePrintSettings() {
    this.showPrintSettings = !this.showPrintSettings;
  }

  convertToStl() {
    if(!this.scadCode.trim()){
      this.error = 'Please enter some OPENSCAD code';
      return;
    }

    this.isConverting = true;
    this.error = null;
    this.stlFileGenerated = false;

    this.conversionService.convertScadToStl(this.scadCode).subscribe(
      (stlBlob: Blob) => {
        // Create a download link for the STL file
        const url = window.URL.createObjectURL(stlBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated-stl.stl';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        this.isConverting = false;
        this.stlFileGenerated = true;
      },
      error => {
        console.error('Error converting SCAD to STL:', error);
        this.error = 'Failed to convert SCAD to STL. Please check your code and try again.';
        this.isConverting = false;
      }
    );
  }

  convertToGcode() {
    if(!this.scadCode.trim()){
      this.error = 'Please enter some OPENSCAD code';
      return;
    }

    this.isConverting = true;
    this.error = null;

    this.conversionService.convertScadToGcode(
      this.scadCode,
      this.selectedPrinterType,
      this.selectedFilamentType,
      this.selectedQualityProfile
    ).subscribe((gcodeBlob: Blob) => {
      // Create a download link for the G-code file
      const url = window.URL.createObjectURL(gcodeBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-gcode.gcode';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      this.isConverting = false;
    }, error => {
      console.error('Error converting SCAD to G-code:', error);
      this.error = 'Failed to convert SCAD to G-code. Please check your code and try again.';
      this.isConverting = false;
    }
    );
  }

  uploadStlFile() {
    this.showStlUpload = true;
  }

  onStlFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    if(fileInput.files && fileInput.files.length > 0) {
      this.selectedStlFile = fileInput.files[0];
    }
  }

  convertStlToGcode() {
    if(!this.selectedStlFile) {
      this.error = 'Please select an STL file to convert';
      return;
    }

    this.isConverting = true;
    this.error = null;

    this.conversionService.convertStlToGcode(
      this.selectedStlFile,
      this.selectedPrinterType,
      this.selectedFilamentType,
      this.selectedQualityProfile
    ).subscribe((gcodeBlob: Blob) => {
      // Create a download link for the G-code file
      const url = window.URL.createObjectURL(gcodeBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-gcode.gcode';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      this.isConverting = false;
    }
    );
  }
}
