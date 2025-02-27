import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { deepseek } from '../../environments/deepseek';
import OpenAI from 'openai';

@Injectable({
  providedIn: 'root'
})
export class DeepseekService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: deepseek.deepseekApiKey,
      baseURL: '/api',
      dangerouslyAllowBrowser: true

    });
  }

  sendRequest(prompt: string): Observable<any> {
    return from(this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    }));
  }
}
