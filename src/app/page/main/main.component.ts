import {Component, OnDestroy, OnInit} from '@angular/core';
import {MarkdownComponent} from "ngx-markdown";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {ReactiveFormsModule} from "@angular/forms";
import {SvgviewerComponent} from "../../components/svgviewer/svgviewer.component";
import {ThreedViewerComponent} from "../../components/threed-viewer/threed-viewer.component";
import {ChatComponent} from "../../components/chat/chat.component";
import {Subscription} from "rxjs";
import {ChatService} from "../../services/chat.service";
import {DrawingComponent} from "../../components/drawing/drawing.component";
import {BaseChatAgentService} from "../../services/base-chat-agent.service";
import {ConsultantService} from "../../services/consultant.service";
import {IterationAgentService} from "../../services/iteration-agent.service";

interface ChatMessage {
  id: number;
  text: string;
  isUser?: boolean;
  isSystem?: boolean;
  timestamp?: Date;
  needMoreInformation: boolean;
  options?: Array<any>;
  imageData?: string;
  type?: 'text' | 'image';
}

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    NgIf,
    ReactiveFormsModule,
    ThreedViewerComponent,
    ChatComponent,
    DrawingComponent,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css'
})
export class MainComponent implements OnInit, OnDestroy{
  messages: any[] = [];
  isLoading = false;
  isSpeaking = false;
  isRecording = false;
  threeDAgent = false;
  isDrawing = true;
  modelUrl: string | null = null;

  private subscriptions: Subscription[] = [];
  private speechSynthesis: SpeechSynthesis | null = null;
  private speechRecognition: any = null;

  constructor(private iterationAgent: IterationAgentService) {
    // Initialize speech synthesis if available
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
    }

    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window) {
      // @ts-ignore - WebKit Speech Recognition API
      this.speechRecognition = new webkitSpeechRecognition();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.onSendMessage(transcript);
      };

      this.speechRecognition.onend = () => {
        this.isRecording = false;
      };
    }
  }

  ngOnInit(): void {

  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());

    // Stop any ongoing speech
    if (this.speechSynthesis && this.isSpeaking) {
      this.speechSynthesis.cancel();
    }

    // Stop any recording
    if (this.speechRecognition && this.isRecording) {
      this.speechRecognition.stop();
    }
  }

  onSendMessage(message: string): void {
    // Add user message to the conversation
    const userMessage = {
      id: Date.now(),
      text: message,
      isUser: true,
      needMoreInformation: false,
      timestamp: new Date()
    };

    this.messages = [...this.messages, userMessage];
    this.isLoading = true;

    // Send message to the agent
    this.iterationAgent.sendMessage(message)
      .then(response => {
        this.isLoading = false;

        // Add the response to messages
        const responseMessage = {
          id: Date.now() + 1,
          text: response.message || '',
          isUser: false,
          isSystem: true,
          needMoreInformation: false,
          timestamp: new Date()
        };

        this.messages = [...this.messages, responseMessage];
        this.handleResponseActions(response);
      })
      .catch(error => {
        console.error('Error sending message:', error);
        this.isLoading = false;
      });
  }

  onOptionSelected(event: {option: any, message: any}): void {
    const { option, message } = event;
    // Handle option selection based on your application logic
    console.log('Option selected:', option, 'for message:', message);

    if (option.value) {
      this.onSendMessage(option.value);
    }
  }

  onSpeakText(text: string): void {
    this.readResponseAloud(text);
  }

  readResponseAloud(text: string): void {
    if (!this.speechSynthesis) return;

    // Cancel any ongoing speech
    this.speechSynthesis.cancel();

    if (this.isSpeaking) {
      this.isSpeaking = false;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
    };

    this.speechSynthesis.speak(utterance);
  }

  onToggleRecording(): void {
    if (!this.speechRecognition) return;

    this.isRecording = !this.isRecording;

    if (this.isRecording) {
      this.speechRecognition.start();
    } else {
      this.speechRecognition.stop();
    }
  }

  private handleResponseActions(response: any): void {
    // Handle any special actions from the response
    if (response.action === 'show3D') {
      this.threeDAgent = true;

      // If response includes a modelUrl, set it
      if (response.modelUrl) {
        this.modelUrl = response.modelUrl;
      }
    }
  }

  sendDrawingToChat(imageData: string) {
    // Create a message text describing the drawing
    const messageText = 'Sent a drawing';

    // First, add the message to the UI
    const userMessage = {
      id: Date.now(),
      text: messageText,
      isUser: true,
      needMoreInformation: false,
      timestamp: new Date(),
      imageData: imageData,
      type: 'image'
    };

    this.messages = [...this.messages, userMessage];
    this.isLoading = true;

    // Send drawing description to the API
    this.iterationAgent.sendMessage(`[User sent a drawing: ${imageData.substring(0, 30)}...]`)
      .then(response => {
        this.isLoading = false;

        // Add the response to messages
        const responseMessage = {
          id: Date.now() + 1,
          text: response.message || '',
          isUser: false,
          isSystem: true,
          needMoreInformation: false,
          timestamp: new Date()
        };

        this.messages = [...this.messages, responseMessage];
        this.handleResponseActions(response);
      })
      .catch(error => {
        console.error('Error sending drawing:', error);
        this.isLoading = false;
      });
  }
}
