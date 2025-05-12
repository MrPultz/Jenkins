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
  private abortController: AbortController | null = null;

  constructor(http: HttpClient) {
    super(http);
  }

  protected override getSystemPromptPath(): string {
    return '/assets/agents/theOnePromptWithMultiple.txt'; // Same prompt path as original
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
    buttonParams: any,
    designs?: any[]
  } {
    // Default return values
    let result: {
      cleanedResponse: string,
      buttonLayout: number[][] | null,
      buttonParams: any,
      designs?: any[]
    } = {
      cleanedResponse: responseText,
      buttonLayout: null,
      buttonParams: null
    };

    try {
      // First, try to extract JSON data if present
      const jsonMatch = responseText.match(/\{[\s\S]*"designs"[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const jsonData = JSON.parse(jsonStr);

        if (jsonData.designs && Array.isArray(jsonData.designs) && jsonData.designs.length > 0) {
          // Add designs property only when we have designs
          result = {
            ...result,
            designs: jsonData.designs
          };

          // Use the first design for buttonLayout and buttonParams
          const firstDesign = jsonData.designs[0];
          if (firstDesign.button_layout) {
            result.buttonLayout = firstDesign.button_layout;
          }
          if (firstDesign.button_params) {
            result.buttonParams = firstDesign.button_params;
          }

          // Clean the response by removing the JSON part
          const jsonStart = responseText.indexOf('{');
          const jsonEnd = responseText.lastIndexOf('}') + 1;
          if (jsonStart !== -1 && jsonEnd !== -1) {
            result.cleanedResponse =
              responseText.substring(0, jsonStart).trim() +
              (jsonEnd < responseText.length ? '\n\n' + responseText.substring(jsonEnd).trim() : '');
          }

          return result;
        }
      }

      // Fall back to the original parsing logic for SCAD Parameters format
      if (responseText.includes('SCAD Parameters')) {
        // Look for button_layout section
        if (responseText.includes('button_layout')) {
          // Find all numeric patterns that could represent button coordinates
          const buttonPattern = /\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)(?:\s*,\s*(-?\d+\.?\d*))?\s*\]/g;
          const buttons = [];
          let match;

          // Extract all button matches from the text
          while ((match = buttonPattern.exec(responseText)) !== null) {
            // Create button with x, y, size values (all required)
            const button = [
              parseFloat(match[1]),
              parseFloat(match[2]),
              parseFloat(match[3])
            ];

            // Add width if it exists
            if (match[4]) {
              button.push(parseFloat(match[4]));
            }

            buttons.push(button);
          }

          if (buttons.length > 0) {
            result.buttonLayout = buttons;
          }
        }

        // Find the button params section
        const buttonParamsMatch = responseText.match(/button_params\s*=\s*\[([\s\S]*?)\];/);
        if (buttonParamsMatch && buttonParamsMatch[1]) {
          const buttonParamsString = `[${buttonParamsMatch[1]}]`;
          // Convert string representation to actual array
          result.buttonParams = new Function(`return ${buttonParamsString}`)();
        }

        // Remove SCAD Parameters section but keep "Would you like to:" part
        const scadSectionStart = responseText.indexOf('SCAD Parameters');
        const wouldYouLikeIndex = responseText.indexOf('Would you like to:');

        if (scadSectionStart !== -1 && wouldYouLikeIndex !== -1) {
          // Combine the text before SCAD Parameters and after the button_params
          result.cleanedResponse =
            responseText.substring(0, scadSectionStart).trim() +
            '\n\n' +
            responseText.substring(wouldYouLikeIndex).trim();
        }
      }
    } catch (error) {
      console.error('Error extracting parameters:', error);
      // If there's an error, return the original text
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
