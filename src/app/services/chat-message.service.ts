import { Injectable } from '@angular/core';
import {environment} from "../../environments/environment";
import {deepseek} from "../../environments/deepseek";
import {HttpClient} from "@angular/common/http";
import {Observable, ObservedValueOf} from "rxjs";
import {OpenAI} from "openai";



export interface ChatMessage {
  id: number;
  text: string;
  isUser?: boolean;
  isSystem?: boolean;
  timestamp ?: Date;
  needMoreInformation: boolean;
}

export interface ChatRequest {
  message: string;
  userId?: string;
  sessionId?: string;
}

export interface ChatResponse {
  message: string;
  needMoreInformation: boolean;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})

export class ChatMessageService {

  private openai = new OpenAI({
    baseURL: deepseek.apiUrl,
    apiKey: deepseek.deepseekApiKey,
    dangerouslyAllowBrowser: true
  })

  private sessionId: string | null = null;
  private systemPrompt: any = null;

  constructor(private http: HttpClient) {
    //Load the system prompt when the service initializes
    this.loadSystemPrompt();

  }

  private async loadSystemPrompt() {
    try {
      this.systemPrompt = await fetch('/assets/agents/02_functionalDesign.json')
        .then(response => response.json());
    } catch (error) {
      console.error('Error loading system prompt:', error);
      // Fallback system prompt if file can't be loaded
      this.systemPrompt = {
        system_prompt: "You are a helpful assistant that creates 3D objects based on user descriptions.",
        user_prompt_template: "{user_input}"
      };
    }
  }

  async sendMessage(message: string): Promise<any> {
    // Ensure system prompt is loaded
    if (!this.systemPrompt) {
      await this.loadSystemPrompt();
    }

    let designConfig = {
      messages: [{
        role: 'system' as const,
        content: 'helpful assistant that talks with the user that keeps your answers short.',
      },
        {
          role: 'user' as const,
          content: message
        }
      ],
      model: 'deepseek-chat',
      temperature: 0.0,
      max_tokens: 1000
    };

    try {
      const completion = await this.openai.chat.completions.create(designConfig);
      return {
        message: completion.choices[0].message.content,
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

  // Get initial welcome message
  async getInitialMessage(): Promise<any> {
    // Use a simple welcome message without calling the API
    return Promise.resolve({
      message: 'Welcome to the Object Generator! I can help you create various 3D objects. What would you like to generate today?',
      needMoreInformation: false,
      sessionId: 'new-session-' + Date.now()
    });
  }
}
