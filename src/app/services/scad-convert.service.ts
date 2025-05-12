import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";


//TODO: Make this be the post to backend, that send the scad command with the parameters.
@Injectable({
  providedIn: 'root'
})
export class ScadConvertService {
  //private apiURL = 'http://localhost:3000/api/' // <- Used when local
  private apiURL = '/api/' // <- Used when deployed

  constructor(private http: HttpClient) { }

  convertToScad(components: any[], buttonParams ?: any): Observable<Blob> {
    // Convert component data to button_layout format
    const buttonLayout = this.formatButtonLayout(components);
    let scadCommand = `button_layout=${JSON.stringify(buttonLayout)}`;

    // Declare paramsArray outside the if block so it's available in the full method scope
    let paramsArray = null;

    console.log('SCAD Command:', scadCommand);

    if (buttonParams) {
      paramsArray = [
        buttonParams.case_width || 0,
        buttonParams.case_depth || 0,
        buttonParams.wall_thickness || 2.5,
        buttonParams.corner_radius || 2,
        buttonParams.top_thickness || 2,
        buttonParams.button_size || 18,
        buttonParams.edge_margin || 8,
        buttonParams.lip_height || 2,
        buttonParams.lip_clearance || 0.1,
        buttonParams.case_height || 15
      ];

      scadCommand += `; button_params=${JSON.stringify(paramsArray)}`;
    }

    console.log('SCAD Command:', scadCommand);
    // Send to backend
    return this.http.post(`${this.apiURL}convert-to-scad`,
      { scadCommand, buttonLayout, buttonParams: paramsArray },
      { responseType: 'blob' }
    );
  }

  private formatButtonLayout(components: any[]): number[][] {
    // Filter only button components
    const buttons = components.filter(comp => comp.type === 'button');

    // Extract x, y, size values into 2D array format
    return buttons.map(button => [
      button.x || 0,
      button.y || 0,
      button.size || 0,
      button.width || 0
    ]);
  }

}
