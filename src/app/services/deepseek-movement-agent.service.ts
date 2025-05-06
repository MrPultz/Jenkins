import { Injectable } from '@angular/core';
import { BaseMovementAgentService, MovementResponse } from "./base-movement-agent.service";
import { OpenAI } from 'openai';
import { deepseek } from "../../environments/deepseek";
import { HttpClient } from "@angular/common/http";
import { Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DeepseekMovementAgentService extends BaseMovementAgentService {
  private openai = new OpenAI({
    baseURL: deepseek.apiUrl,
    apiKey: deepseek.deepseekApiKey,
    dangerouslyAllowBrowser: true
  });

  constructor(http: HttpClient) {
    super(http);
  }

  protected getSystemPromptPath(): string {
    return 'assets/agents/moveAgent.txt';
  }

  processMovementInstruction(message: string, modelContext?: any): Observable<MovementResponse> {
    return from(this.loadSystemPromptIfNeeded()).pipe(
      map(() => this.systemPromptContent || this.getFallbackSystemPrompt()),
      switchMap(systemPrompt =>
        from(this.openai.chat.completions.create({
          model: 'deepseek-chat',
          max_tokens: 1000,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: modelContext
                ? `USER REQUEST: ${message}\n\nMODEL CONTEXT: ${JSON.stringify(modelContext, null, 2)}`
                : message
            }
          ]
        }))
      ),
      map(completion => {
        // Safely access the content using DeepSeek's response format
        const content = completion.choices?.[0]?.message?.content || '';
        return this.parseResponse(content);
      }),
      catchError(error => {
        console.error('Error processing movement with DeepSeek:', error);
        return of(this.createDefaultResponse(message));
      })
    );
  }

  private async loadSystemPromptIfNeeded(): Promise<void> {
    if (!this.systemPromptContent) {
      await this.loadSystemPrompt();
    }
  }

  // Helper method to create appropriate fallback response
  // Uses different name to avoid conflict with base class
  protected createDefaultResponse(message: string): MovementResponse {
    const lowerText = message.toLowerCase();

    if (lowerText.includes('move') || lowerText.includes('position')) {
      return {
        action: 'position',
        values: [0.5, 0, 0],
        description: 'Moved right by a small amount'
      };
    } else if (lowerText.includes('rotate') || lowerText.includes('turn')) {
      return {
        action: 'rotation',
        values: [0, 0.2, 0],
        description: 'Rotated slightly clockwise'
      };
    } else {
      return {
        action: 'scale',
        values: [1.1, 1.1, 1.1],
        description: 'Increased size slightly'
      };
    }
  }
}
