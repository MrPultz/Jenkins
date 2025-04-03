import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";


//TODO: Make this be the post to backend, that send the scad command with the parameters.
@Injectable({
  providedIn: 'root'
})
export class ScadConvertService {
  private apiURL = 'http://localhost:3000'

  constructor(private http: HttpClient) { }

  convertToScad(components: any[]): Observable<Blob> {
    // Convert component data to button_layout format
    const buttonLayout = this.formatButtonLayout(components);
    const scadCommand = `button_layout=${JSON.stringify(buttonLayout)}`;

    console.log('SCAD Command:', scadCommand);

    // Send to backend
    return this.http.post(`${this.apiURL}/api/convert-to-scad`,
      { scadCommand },
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
      button.size || 0
    ]);
  }

}
