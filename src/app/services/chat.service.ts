import { Injectable } from '@angular/core';
import {deepseek} from "../../environments/deepseek";
import {BehaviorSubject, Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiURL = deepseek.apiUrl;
  private messagesSubject = new BehaviorSubject<any[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private speakingSubject = new BehaviorSubject<boolean>(false);

  public messages$ = this.messagesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public speaking$ = this.speakingSubject.asObservable();

  private speechSynthesis: SpeechSynthesis;
  private speechRecognition: any;
  private isRecording = false;

  constructor(private http: HttpClient) {
    this.speechSynthesis = window.speechSynthesis;

    // Setup speech recognition if available
    if('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognitionResult;
      this.speechRecognition = new SpeechRecognition();
      this.setupSpeechRecognition();
    }
  }


  sendMessage(message: string): Observable<any> {
    if (!message.trim()) { // @ts-ignore
      return;
    }

    const messages = this.messagesSubject.value;

    // Add user message
    const userMessage = {
      id: messages.length,
      text: message,
      isUser: true,
      isSystem: false,
      timestamp: new Date()
    };

    this.messagesSubject.next([...messages, userMessage]);
    this.loadingSubject.next(true);

    // Send to backend
    return this.http.post(this.apiURL, { message });
  }

  receiveMessage(response: any): void {
    const messages = this.messagesSubject.value;

    // Add system message
    const systemMessage = {
      id: messages.length,
      text: response.message,
      isUser: false,
      isSystem: true,
      timestamp: new Date(),
      options: response.options || [],
      needMoreInformation: response.needMoreInformation || false
    };

    this.messagesSubject.next([...messages, systemMessage]);
    this.loadingSubject.next(false);
  }

  readResponseAloud(text: string): void {
    if (this.speechSynthesis) {
      // Stop any current speech
      this.speechSynthesis.cancel();

      // Convert markdown to plain text
      const plainText = this.stripMarkdown(text);

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.speakingSubject.next(true);
      };

      utterance.onend = () => {
        this.speakingSubject.next(false);
      };

      this.speechSynthesis.speak(utterance);
    }
  }

  toggleVoiceRecognition(): void {
    if (!this.speechRecognition) return;

    if (this.isRecording) {
      this.speechRecognition.stop();
      this.isRecording = false;
    } else {
      this.speechRecognition.start();
      this.isRecording = true;
    }
  }

  private setupSpeechRecognition(): void {
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = false;
    this.speechRecognition.lang = 'en-US';

    this.speechRecognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;

      // Handle the transcript (e.g., send as a message)
      this.sendMessage(transcript);
    };

    this.speechRecognition.onend = () => {
      this.isRecording = false;
    };

    this.speechRecognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      this.isRecording = false;
    };
  }

  private stripMarkdown(text: string): string {
    // Simple markdown stripping for speech
    return text
      .replace(/#+\s/g, '') // headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // bold
      .replace(/\*(.*?)\*/g, '$1') // italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // code
      .replace(/^>+\s/gm, '') // blockquotes
      .replace(/^-\s/gm, '- ') // list items
      .replace(/^[0-9]+\.\s/gm, '$1. '); // numbered lists
  }

  // Method to save STL files
  saveStlFile(blob: Blob, fileName?: string): void {
    // Create a date-time string for filename uniqueness
    const date = new Date();
    const dateString = date.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const name = fileName || `3d-model-${dateString}.stl`;

    // Create a download link
    const downloadLink = document.createElement('a');
    downloadLink.href = window.URL.createObjectURL(blob);
    downloadLink.download = name;

    // Append to the document, click it, then remove it
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // Clean up
    document.body.removeChild(downloadLink);
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadLink.href);
    }, 100);

    console.log('STL file saved to downloads');
  }
}
