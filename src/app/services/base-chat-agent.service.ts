import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OpenAI } from 'openai';
import { environment } from '../../environments/environment';
import { deepseek } from '../../environments/deepseek';

export interface ChatOption {
  id: number;
  label: string;
  description?: string;
}
export interface ChatMessage {
  id: number;
  text: string;
  isUser?: boolean;
  isSystem?: boolean;
  timestamp?: Date;
  needMoreInformation: boolean;
  options?: ChatOption[];
}

export interface ChatResponse {
  message: string;
  needMoreInformation: boolean;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export abstract class BaseChatAgentService {
  protected openai = new OpenAI({
    baseURL: deepseek.apiUrl,
    apiKey: deepseek.deepseekApiKey,
    dangerouslyAllowBrowser: true
  });

  protected sessionId: string | null = null;
  protected systemPrompt: any = null;

  protected constructor(protected http: HttpClient) {
    // Load the system prompt when the service initializes
    this.loadSystemPrompt();
  }

  // Abstract method to be implemented by derived classes
  protected abstract getSystemPromptPath(): string;

  // Abstract method to get welcome message
  protected abstract getWelcomeMessage(): string;

  protected async loadSystemPrompt() {
    try {
      // Fetch the text file
      const response = await fetch(this.getSystemPromptPath());
      // Get the text content instead of parsing as JSON
      const textContent = await response.text();

      // Create the system prompt structure manually
      this.systemPrompt = {
        system_prompt: textContent,
        user_prompt_template: "{user_input}"
      };
    } catch (error) {
      console.error('Error loading system prompt:', error);
      // Fallback system prompt if file can't be loaded
      this.systemPrompt = {
        system_prompt: this.getFallbackSystemPrompt(),
        user_prompt_template: "{user_input}"
      };
    }
  }

  // Can be overridden by subclasses
  protected getFallbackSystemPrompt(): string {
    return "You are a helpful assistant.";
  }
  async sendMessage(message: string): Promise<ChatResponse> {
    if (!this.systemPrompt) {
      await this.loadSystemPrompt();
    }

    let designConfig = {
      messages: [{
        role: 'system' as const,
        content: this.systemPrompt.system_prompt || this.getFallbackSystemPrompt(),
      }, {
        role: 'user' as const,
        content: message
      }],
      model: 'deepseek-chat',
      temperature: 0.0,
      max_tokens: 1000
    };

    try {
      const completion = await this.openai.chat.completions.create(designConfig);
      return {
        message: completion.choices[0].message.content || '',
        needMoreInformation: false,
        sessionId: this.sessionId || 'new-session-' + Date.now(),
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  async getInitialMessage(): Promise<ChatResponse> {
    return Promise.resolve({
      message: this.getWelcomeMessage(),
      needMoreInformation: false,
      sessionId: 'new-session-' + Date.now()
    });
  }
}
