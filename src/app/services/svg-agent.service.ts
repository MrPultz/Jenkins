import { Injectable } from '@angular/core';
import {BaseChatAgentService, ChatResponse} from "./base-chat-agent.service";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class SvgAgentService extends BaseChatAgentService{
  constructor(http: HttpClient) {
    super(http);
  }

  protected override getSystemPromptPath(): string {
    return '/assets/agents/svgAgent.txt';
  }

  protected override getFallbackSystemPrompt(): string {
    return "You are an expert SVG generator. Create SVG code based on user descriptions.";
  }

  protected override getWelcomeMessage(): string {
    return "Hello! I'm your SVG generator. Describe what you'd like me to create, and I'll generate an SVG for you.";
  }

  override async sendMessage(message: string): Promise<ChatResponse> {
    // Ensure message is not null or undefined before passing to parent
    return super.sendMessage(message || '');
  }
}
