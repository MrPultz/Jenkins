import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import Anthropic from '@anthropic-ai/sdk';
import { claude } from '../../environments/claude';
import { ChatResponse } from './base-chat-agent.service';

@Injectable({
  providedIn: 'root'
})
export abstract class AnthropicChatAgentService {

  protected anthropic: Anthropic;
  protected sessionId: string | undefined;
  protected systemPrompt: any = null;

  // Store the full conversation history including system, user, and assistant messages
  protected messages: Array<{role: 'user' | 'assistant', content: string | any[]}> = [];
  protected systemPromptContent: string = '';

  protected constructor(protected http: HttpClient) {
    this.anthropic = new Anthropic({
      apiKey: claude.apiKey,
      dangerouslyAllowBrowser: true
    });

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
      // Get the text content
      this.systemPromptContent = await response.text();
    } catch (error) {
      console.error('Error loading system prompt:', error);
      // Fallback system prompt if file can't be loaded
      this.systemPromptContent = this.getFallbackSystemPrompt();
    }
  }

  // Can be overridden by subclasses
  protected getFallbackSystemPrompt(): string {
    return "You are a helpful assistant.";
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    // Make sure system prompt is loaded
    if (!this.systemPromptContent) {
      await this.loadSystemPrompt();
    }

    // Log the current session state
    console.log('Current session ID before sending:', this.sessionId);

    // Generate a new session ID only if one doesn't exist
    if (!this.sessionId) {
      this.sessionId = 'new-session-' + Date.now();
      console.log('Created new session ID:', this.sessionId);

      // Reset messages for new session
      this.messages = [];
    }

    // Always add the new user message to the conversation
    this.messages.push({
      role: 'user',
      content: message
    });

    console.log('Full message history before API call:', JSON.stringify(this.messages));

    try {
      // Send the message to Anthropic Claude
      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0,
        system: this.systemPromptContent,
        messages: this.messages
      });

      // Get the assistant's response
      const contentBlock = response.content[0];
      const assistantMessage = contentBlock?.type === 'text' ? contentBlock.text : '';

      // Add the assistant's response to conversation history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage
      });

      console.log('Updated message history after API response:', JSON.stringify(this.messages));

      // Return the response with the existing session ID
      return {
        message: assistantMessage,
        needMoreInformation: false,
        sessionId: this.sessionId
      };
    } catch (error) {
      console.error('Error sending message to Claude:', error);
      throw error;
    }
  }

  async sendMessageWithImage(message: string, imageData: string): Promise<ChatResponse> {
    // Make sure system prompt is loaded
    if (!this.systemPromptContent) {
      await this.loadSystemPrompt();
    }

    // Generate a new session ID only if one doesn't exist
    if (!this.sessionId) {
      this.sessionId = 'new-session-' + Date.now();
      // Reset messages for new session
      this.messages = [];
    }

    // Create a message object with image content
    const userMessageWithImage: {role: 'user', content: any[]} = {
      role: 'user',
      content: [
        { type: 'text', text: message },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData.replace(/^data:image\/png;base64,/, '') } }
      ]
    };

    // Add the message to conversation history
    this.messages.push(userMessageWithImage);

    try {
      // Send the message to Anthropic Claude
      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0,
        system: this.systemPromptContent,
        messages: this.messages
      });

      // Get the assistant's response
      const contentBlock = response.content[0];
      const assistantMessage = contentBlock?.type === 'text' ? contentBlock.text : '';

      // Add the assistant's response to conversation history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Return the response with the existing session ID
      return {
        message: assistantMessage,
        needMoreInformation: false,
        sessionId: this.sessionId
      };
    } catch (error) {
      console.error('Error sending message with image to Claude:', error);
      throw error;
    }
  }

  setSessionId(sessionId: string): void {
    console.log('Setting session ID:', sessionId);

    // If changing to a different session ID, reset conversation history
    if (this.sessionId !== sessionId) {
      console.log('Session changed, resetting conversation history');
      this.messages = [];
    }

    this.sessionId = sessionId;
  }

  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  async getInitialMessage(): Promise<ChatResponse> {
    // Create a new session ID
    this.sessionId = 'new-session-' + Date.now();

    // Initialize with empty conversation
    this.messages = [];

    return Promise.resolve({
      message: this.getWelcomeMessage(),
      needMoreInformation: false,
      sessionId: this.sessionId
    });
  }
}
