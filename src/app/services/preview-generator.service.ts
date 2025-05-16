import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable, forkJoin, timeout} from 'rxjs';
import { map } from 'rxjs/operators';

export interface PreviewDesign {
  id: string;
  previewUrl: string;
  description: string;
  params: any;
}
@Injectable({
  providedIn: 'root'
})
export class PreviewGeneratorService {

  //private apiURL = 'http://localhost:3000/api/';
  private apiURL = '/api/';

  constructor(private http:HttpClient) { }

  /**
   * Generate preview images without creating STL files
   * @param count Number of previews to generate
   */
  generatePreviews(count: number = 3): Observable<PreviewDesign[]> {
    return this.http.post<PreviewDesign[]>(`${this.apiURL}generate-previews`, { count });
  }

  /**
   * Generate STL file for a selected design
   * @param designId The ID of the selected design
   */
  generateStlFromDesign(designId: string, design: any): Observable<Blob> {
    return this.http.post(
      `${this.apiURL}generate-stl`,
      {
        designId: designId,
        design: design  // Include the complete design object
      },
      { responseType: 'blob' }
    ).pipe(
      timeout(900000)
    );
  }

  /**
   * Generate multiple previews in parallel for better performance
   * @param count Number of previews to generate
   */
  generateParallelPreviews(count: number = 3): Observable<PreviewDesign[]> {
    // Create array of requests
    const requests = Array(count).fill(0).map((_, i) =>
      this.http.post<PreviewDesign>(`${this.apiURL}generate-single-preview`, { index: i })
    );

    // Run requests in parallel
    return forkJoin(requests);
  }

  generatePreviewsFromJson(designData: any, count: number): Observable<PreviewDesign[]> {
    console.log("sending designData to backend:", designData);

    // Properly extract the designs array
    let designs: any[] = [];
    if (designData.designs && Array.isArray(designData.designs)) {
      designs = designData.designs;
    } else if (Array.isArray(designData)) {
      designs = designData;
    } else {
      designs = [designData]; // Fallback to single design case
    }

    // Create properly formatted designs with all required fields
    const designsToSend = designs.slice(0, count).map((design: any, index: number) => {
      return {
        id: design.id || `design-${index + 1}`,
        type: design.type || 'custom',
        button_layout: design.buttonLayout || design.button_layout || [],
        button_params: design.buttonParams || design.button_params || {}
      };
    });

    console.log('Sending designs to backend:', JSON.stringify(designsToSend));

    return this.http.post<any[]>(`${this.apiURL}generate-previews`, {
      designs: designsToSend
    }).pipe(
      map(results => {
        return results.map((result: any, index: number) => ({
          id: `design_${result.id || index + 1}`, // Convert ID to string format that works with split
          previewUrl: result.preview || '',
          description: result.type || 'Custom design',
          params: {
            buttonLayout: designsToSend[index]?.button_layout || [],
            buttonParams: designsToSend[index]?.button_params || {}
          }
        }));
      })
    );
  }


}
