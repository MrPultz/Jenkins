import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";

// Replaced with scad converter service
@Injectable({
  providedIn: 'root'
})
export class ConversionServiceService {
  //private apiURL = 'http://localhost:3000/api/'
  private apiURL = '/api/' // <- Used when deployed

  constructor(private http: HttpClient) { }

  convertScadToStl(scadCode: string): Observable<Blob> {
    return this.http.post(`${this.apiURL}convert-scad-to-stl`, { scadCode }, { responseType: 'blob'});
  }

  convertStlToGcode(stlFile: File, printerType?: string, filamentType?: string, qualityProfile?: string): Observable<Blob> {
    const formData = new FormData();
    formData.append('stlFile', stlFile);

    if(printerType) formData.append('printerType', printerType);
    if(filamentType) formData.append('filamentType', filamentType);
    if(qualityProfile) formData.append('qualityProfile', qualityProfile);

    return this.http.post(`${this.apiURL}convert-stl-to-gcode`, formData, { responseType: 'blob'});
  }

  convertScadToGcode(
    scadCode: string,
    printerType?: string,
    filamentType?: string,
    qualityProfile?: string
  ): Observable<Blob> {
    const body = {
      scadCode,
      printerType,
      filamentType,
      qualityProfile
    };

    return this.http.post(`${this.apiURL}convert-scad-to-gcode`, body, { responseType: 'blob'});
  }
}


