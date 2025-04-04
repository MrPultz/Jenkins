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
  projectData?: any; // Added to store extracted project data
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

  protected sessionId: string | undefined;
  protected systemPrompt: any = null;

  // Store the full conversation history including system, user, and assistant messages
  protected messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [];

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
    // Make sure system prompt is loaded
    if (!this.systemPrompt) {
      await this.loadSystemPrompt();
    }

    // Log the current session state
    console.log('Current session ID before sending:', this.sessionId);

    // Generate a new session ID only if one doesn't exist
    if (!this.sessionId) {
      this.sessionId = 'new-session-' + Date.now();
      console.log('Created new session ID:', this.sessionId);

      // Initialize conversation with system message only for new sessions
      this.messages = [{
        role: 'system',
        content: this.systemPrompt.system_prompt || this.getFallbackSystemPrompt()
      }];
    }

    // Always add the new user message to the conversation
    this.messages.push({
      role: 'user',
      content: message
    });

    console.log('Full message history before API call:', JSON.stringify(this.messages));

    try {
      // Send the complete message history to DeepSeek
      const completion = await this.openai.chat.completions.create({
        model: 'deepseek-chat',
        temperature: 0.0,
        max_tokens: 8000,
        messages: this.messages
      });

      // Get the assistant's response
      const assistantMessage = completion.choices[0].message;

      // Add the assistant's response to our conversation history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage.content || ''
      });

      console.log('Updated message history after API response:', JSON.stringify(this.messages));

      // Return the response with the existing session ID
      return {
        message: assistantMessage.content || '',
        needMoreInformation: false,
        sessionId: this.sessionId
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  setSessionId(sessionId: string): void {
    console.log('Setting session ID:', sessionId);

    // If changing to a different session ID, reset conversation history
    if (this.sessionId !== sessionId) {
      console.log('Session changed, resetting conversation history');
      this.messages = [{
        role: 'system',
        content: this.systemPrompt?.system_prompt || this.getFallbackSystemPrompt()
      }];
    }

    this.sessionId = sessionId;
  }

  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  async getInitialMessage(): Promise<ChatResponse> {
    // Create a new session ID
    this.sessionId = 'new-session-' + Date.now();

    // Initialize the conversation with just the system message
    this.messages = [{
      role: 'system',
      content: this.systemPrompt?.system_prompt || this.getFallbackSystemPrompt()
    }];

    return Promise.resolve({
      message: this.getWelcomeMessage(),
      needMoreInformation: false,
      sessionId: this.sessionId
    });
  }
}
