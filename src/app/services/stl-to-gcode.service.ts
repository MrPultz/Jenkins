import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class StlToGcodeService {
  private apiURL = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  convertStlToGcode(stlData: Blob | File): Observable<Blob> {
    // Create FormData to send in the request
    const formData = new FormData();
    formData.append('stl', stlData, 'combined-model.stl');

    // Send to backend endpoint
    return this.http.post(
      `${this.apiURL}/api/process-stl`,
      formData,
      { responseType: 'blob' }
    );
  }
}
