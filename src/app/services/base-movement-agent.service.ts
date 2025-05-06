import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MovementResponse {
  action: 'position' | 'rotation' | 'scale';
  values: [number, number, number];
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export abstract class BaseMovementAgentService {
  protected systemPromptContent: string | null = null;

  constructor(protected http: HttpClient) {
    this.loadSystemPrompt();
  }

  protected abstract getSystemPromptPath(): string;

  protected async loadSystemPrompt() {
    try {
      const response = await fetch(this.getSystemPromptPath());
      this.systemPromptContent = await response.text();
    } catch (error) {
      console.error('Error loading movement agent system prompt:', error);
      // Fallback system prompt for movement agent
      this.systemPromptContent = this.getFallbackSystemPrompt();
    }
  }

  protected getFallbackSystemPrompt(): string {
    return `You are a 3D object placement assistant that understands natural language instructions and converts them to precise numerical values for the ThreeJS scene. When I describe how to move, rotate, or scale the unicorn horn 3D object, translate those instructions into specific coordinate values.

For position changes:
- Left/right movements adjust X axis (negative/positive)
- Up/down movements adjust Y axis (positive/negative)
- Forward/backward movements adjust Z axis (negative/positive)
- Small movements range from 0.1 to 0.5 units
- Medium movements range from 0.5 to 2 units
- Large movements range from 2 to 5 units

For rotations:
- Tilting forward/backward rotates around X axis
- Turning left/right rotates around Y axis
- Rolling clockwise/counterclockwise rotates around Z axis
- Express rotations in radians (for ThreeJS compatibility)
- Small rotations: 0.1 to 0.3 radians (5-15°)
- Medium rotations: 0.3 to 1.0 radians (15-60°)
- Large rotations: 1.0 to 3.14 radians (60-180°)

For scaling:
- Uniform scaling affects all axes equally
- Non-uniform scaling specifies different values per axis
- Small changes: 0.8-1.2 (±20%)
- Medium changes: 0.5-2.0 (±50%)
- Large changes: 0.25-4.0 (±75% or more)

Respond with a valid JSON object containing the specific values needed:
{
  "action": "position|rotation|scale",
  "values": [x, y, z],
  "description": "Brief explanation of the change"
}`;
  }

  abstract processMovementInstruction(message: string): Observable<MovementResponse>;

  protected parseResponse(responseText: string): MovementResponse {
    try {
      console.log('Raw response to parse:', responseText);

      // More robust JSON extraction pattern
      // This looks for the most complete JSON object in the response
      const jsonMatch = responseText.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        console.log('Extracted JSON string:', jsonStr);

        try {
          const parsed = JSON.parse(jsonStr);
          console.log('Parsed response:', parsed);

          // Validate the parsed response has the required fields
          if (
            parsed.action &&
            ['position', 'rotation', 'scale'].includes(parsed.action) &&
            Array.isArray(parsed.values) &&
            parsed.values.length === 3 &&
            parsed.values.every((v: unknown) => typeof v === 'number')
          ) {
            return {
              action: parsed.action as 'position' | 'rotation' | 'scale',
              values: parsed.values as [number, number, number],
              description: parsed.description || 'Movement applied'
            };
          } else {
            console.error('Invalid response structure:', parsed);
          }
        } catch (jsonError) {
          console.error('JSON parsing error:', jsonError, 'for string:', jsonStr);
        }
      } else {
        console.error('No JSON object found in response');
      }

      // If we can't parse or validate the response, return a default
      throw new Error('Could not parse movement response');
    } catch (error) {
      console.error('Error parsing movement response:', error);
      // Use default response with simple heuristics
      return this.createBasicResponse();
    }
  }

  // A simple default response generator that concrete classes can override
  protected createBasicResponse(): MovementResponse {
    return {
      action: 'position',
      values: [0.1, 0, 0],
      description: 'Made a small adjustment'
    };
  }
}
