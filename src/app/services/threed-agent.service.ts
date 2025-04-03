import { Injectable } from '@angular/core';
import {BaseChatAgentService, ChatResponse} from "./base-chat-agent.service";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class ThreedAgentService extends BaseChatAgentService{
  constructor(http: HttpClient) {
    super(http);
  }

  protected override getSystemPromptPath(): string {
    return '/assets/agents/3d_generator.json';
  }

  protected override getFallbackSystemPrompt(): string {
    return "You are a specialized 3D model generator that converts descriptions into 3D models.";
  }

  protected override getWelcomeMessage(): string {
    return "Welcome to the 3D Model Generator! Describe an object (like a remote control), and I'll help you create a 3D model of it.";
  }

  override async sendMessage(message: string): Promise<ChatResponse> {
    // Ensure message is not null or undefined before passing to parent
    return super.sendMessage(message || '');
  }
}
