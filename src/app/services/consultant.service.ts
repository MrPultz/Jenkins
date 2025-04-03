import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {BaseChatAgentService, ChatResponse} from "./base-chat-agent.service";

@Injectable({
  providedIn: 'root'
})
export class ConsultantService extends BaseChatAgentService {

  constructor(http: HttpClient) {
    super(http);
  }

  protected override getSystemPromptPath(): string {
    return '/assets/agents/consultantAgent.txt'; // Change this to a txt file that is right.
  }

  protected override getFallbackSystemPrompt(): string {
    return "You are a consultant that helps users make decisions about product designs and functionality.";
  }

  protected override getWelcomeMessage(): string {
    return "Welcome! I'm your design consultant. How can I help you with your project today?";
  }
  override async sendMessage(message: string): Promise<ChatResponse> {
    // Ensure message is not null or undefined before passing to parent
    return super.sendMessage(message || '');
  }
}
