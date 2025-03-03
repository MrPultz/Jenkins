import { Injectable } from '@angular/core';
import Anthropic from '@anthropic-ai/sdk';
import { environment } from "../../environments/environment";


@Injectable({
  providedIn: 'root'
})
export class AnthropicService {
  private anthropic: Anthropic;


  constructor() {
    this.anthropic = new Anthropic({
      apiKey: environment.anthropicApiKey, // replace to environment variable that does not get upload to git
      dangerouslyAllowBrowser: true, //NOTE: This is only for development purposes
    });
  }

  async sendMessage(message: string) {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', //The model to use for the message
        max_tokens: 1024, //The maximum number of tokens to generate
        messages: [{ role: 'user', content: message }],
      });
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}
