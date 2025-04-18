import { Injectable } from '@angular/core';
import Anthropic from '@anthropic-ai/sdk';
import { environment } from "../../environments/environment";
import {AnthropicChatAgentService} from "./anthropic-chat-agent.service";
import {ChatResponse} from "./base-chat-agent.service";
import {HttpClient} from "@angular/common/http";


@Injectable({
  providedIn: 'root'
})
export class AnthropicIterationAgentService extends AnthropicChatAgentService{
  private buttonLayout: any;
  private buttonParams: any;

  constructor(http: HttpClient) {
    super(http);
  }

  protected override getSystemPromptPath(): string {
    return '/assets/agents/theOnePrompt.txt'; // Same prompt path as original
  }

  protected override getFallbackSystemPrompt(): string {
    return "You are a consultant that helps users make decisions about product designs and functionality.";
  }

  protected override getWelcomeMessage(): string {
    return "Welcome! I'm your design consultant. How can I help you with your project today?";
  }

  override async sendMessage(message: string): Promise<ChatResponse> {
    console.log('Anthropic service sending message with sessionId:', this.sessionId);
    return super.sendMessage(message || '');
  }

  extractScadParameters(responseText: string): {
    cleanedResponse: string,
    buttonLayout: number[][] | null,
    buttonParams: any
  } {
    let result = {
      cleanedResponse: responseText,
      buttonLayout: null as number[][] | null,
      buttonParams: null
    };

    if (responseText.includes('SCAD Parameters')) {
      try {
        // Look for button_layout section
        if (responseText.includes('button_layout')) {
          const buttonPattern = /\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)(?:\s*,\s*(-?\d+\.?\d*))?\s*\]/g;
          const buttons = [];
          let match;

          while ((match = buttonPattern.exec(responseText)) !== null) {
            const button = [
              parseFloat(match[1]),
              parseFloat(match[2]),
              parseFloat(match[3])
            ];

            if (match[4]) {
              button.push(parseFloat(match[4]));
            }

            buttons.push(button);
          }

          if (buttons.length > 0) {
            result.buttonLayout = buttons;
          }
        }

        const buttonParamsMatch = responseText.match(/button_params\s*=\s*\[([\s\S]*?)\];/);
        if (buttonParamsMatch && buttonParamsMatch[1]) {
          const buttonParamsString = `[${buttonParamsMatch[1]}]`;
          result.buttonParams = new Function(`return ${buttonParamsString}`)();
        }

        // Use a more aggressive approach with regex to remove the SCAD Parameters section
        const cleanedText = responseText.replace(/## SCAD Parameters[\s\S]*?button_params.*?\];/s, '');

        // If that didn't work, try alternative regex patterns
        if (cleanedText === responseText) {
          // Try with just "SCAD Parameters" without the ##
          result.cleanedResponse = responseText.replace(/SCAD Parameters[\s\S]*?button_params.*?\];/s, '');
        } else {
          result.cleanedResponse = cleanedText;
        }

        // Clean up any leftover backticks code blocks that might be empty
        result.cleanedResponse = result.cleanedResponse.replace(/```[\s]*```/g, '');

        // Remove any trailing newlines and trim
        result.cleanedResponse = result.cleanedResponse.trim();

      } catch (error) {
        console.error('Error extracting SCAD parameters:', error);
      }
    }

    return result;
  }

  setButtonLayout(layout: any): void {
    this.buttonLayout = layout;
  }

  setButtonParams(params: any): void {
    this.buttonParams = params;
  }

  getButtonLayout(): any {
    return this.buttonLayout;
  }

  getButtonParams(): any {
    return this.buttonParams;
  }

}
