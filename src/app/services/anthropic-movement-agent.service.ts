import { Injectable } from '@angular/core';
import { BaseMovementAgentService, MovementResponse } from './base-movement-agent.service';
import Anthropic from '@anthropic-ai/sdk';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AnthropicMovementAgentService extends BaseMovementAgentService {
  private anthropic = new Anthropic({
    apiKey: environment.anthropicApiKey,
    dangerouslyAllowBrowser: true
  });

  constructor(http: HttpClient) {
    super(http);
  }

  protected getSystemPromptPath(): string {
    return 'assets/agents/moveAgent.txt';
  }

  processMovementInstruction(message: string): Observable<MovementResponse> {
    return from(this.loadSystemPromptIfNeeded()).pipe(
      map(() => this.systemPromptContent || this.getFallbackSystemPrompt()),
      switchMap(systemPrompt =>
        from(this.anthropic.messages.create({
          model: 'claude-3-7-sonnet-20240219',
          max_tokens: 1000,
          temperature: 0.2,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: message
            }
          ]
        }))
      ),
      map(response => {
        const contentBlock = response.content[0];
        const content = contentBlock?.type === 'text' ? contentBlock.text : '';
        return this.parseResponse(content);
      }),
      catchError(error => {
        console.error('Error processing movement with Claude:', error);
        return of(this.createDefaultResponse(message));
      })
    );
  }

  private async loadSystemPromptIfNeeded(): Promise<void> {
    if (!this.systemPromptContent) {
      await this.loadSystemPrompt();
    }
  }

  // Custom response creation for Anthropic
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
