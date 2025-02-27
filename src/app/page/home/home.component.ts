import {Component, ViewEncapsulation} from '@angular/core';
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule, MatFabButton} from "@angular/material/button";
import {MatInputModule} from "@angular/material/input";
import {AnthropicService} from "../../services/anthropic-service.service";
import {FormsModule} from "@angular/forms";
import {DeepseekService} from "../../services/deepseek.service";
import {OpenAI} from 'openai';
import {deepseek} from "../../../environments/deepseek";
import {NgIf} from "@angular/common";


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatIconModule,
    MatFabButton,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    NgIf
  ],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  userInput = '';
  response: any;
  openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: deepseek.deepseekApiKey,
    dangerouslyAllowBrowser: true
  })

  constructor(private anthropicService: AnthropicService, private deepseekService: DeepseekService) {}

  async sendMessage() {
    if(!this.userInput.trim()) return;

    try {
      const response = await this.anthropicService.sendMessage(this.userInput);
      console.log(response);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async callDeepSeekApi() {
     if (!this.userInput.trim()) return;

     const functionalDesign = await fetch('/assets/agents/02_functionalDesign.json')
       .then(response => response.json());

     /*this.deepseekService.sendRequest(this.userInput).subscribe({
       next: (response) => {
         this.response = response.choices[0].message.content;
         console.log('DeepSeek response:', this.response);
       },
       error: (error) => {
         console.error('DeepSeek API error:', error);
         // Handle error appropriately (e.g., show error message to user)
       },
       complete: () => {
         this.userInput = ''; // Clear input after successful response
       }
     });*/
    let designConfig = {
      messages: [{
          role: 'system' as const,
          content: functionalDesign.system_prompt,
          userPromptTemplate: functionalDesign.user_prompt_template
        },
        {
          role: 'user' as const,
          content: this.userInput
        }
      ],
      model: 'deepseek-v3',
      temperature: 0.0,
      max_tokens:1000
    };

    console.log('Sending prompt to DeepSeek:', {
      systemPrompt: designConfig.messages[0],
      userInput: designConfig.messages[1]
    });

    try {
      let completion = await this.openai.chat.completions.create(designConfig);
      this.response = completion.choices[0].message.content;
      console.log('DeepSeek response: ', this.response);
      this.userInput = '';
    } catch (error) {
      console.error('DeepSeek API error:', error);
    }
  }
}
