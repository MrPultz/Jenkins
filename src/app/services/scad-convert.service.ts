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
    console.log('Components:', components);

    const buttonLayout = this.formatButtonLayout(components);

    // Prepare buttonParams array if provided
    let paramsArray = null;
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
    }

    console.log('Button Layout:', buttonLayout);
    console.log('Button Params:', paramsArray);

    // Send to backend using the new endpoint and expected format
    return this.http.post(`${this.apiURL}generate-stl`,
      {
        designId: 'direct',
        buttonLayout: buttonLayout,
        buttonParams: paramsArray
      },
      { responseType: 'blob' }
    );
  }

  private formatButtonLayout(components: any[]): any[][] {
    // Filter only button components
    const buttons = components.filter(comp => comp.type === 'button');
    console.log("buttons", buttons);

    // Extract x, y, text, size, width values into array format
    return buttons.map(button => [
      button.x || 0,
      button.y || 0,
      button.text || "BTN", // Adding text parameter for the button
      button.size || 0,
      button.width || 0
    ]);
  }

}
