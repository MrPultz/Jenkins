// chat.component.ts
import { Component, OnInit } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {SvgviewerComponent} from "../../components/svgviewer/svgviewer.component";
import {ThreedViewerComponent} from "../../components/threed-viewer/threed-viewer.component";
import { ChatMessageService, ChatMessage} from "../../services/chat-message.service";
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    NgForOf,
    NgIf,
    SvgviewerComponent,
    ThreedViewerComponent,
    MarkdownModule
  ],
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
  messages: ChatMessage[] = [];
  inputMessage: string = '';
  generatedSvgCodes: string[] = [];
  selectedSvgIndex: number = 0;
  isLoading: boolean = false;

  constructor(private chatService: ChatMessageService) { }

  async ngOnInit() {
    // Initialize with a welcome message
    this.isLoading = true;
    try {
      const response = await this.chatService.getInitialMessage();
      this.messages.push({
        id: 1,
        text: response.message,
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: response.needMoreInformation
      });

      if (response.sessionId) {
        this.chatService.setSessionId(response.sessionId);
      }
    } catch (error) {
      console.error('Failed to get initial message:', error);
      this.messages.push({
        id: 1,
        text: 'Welcome to the Object Generator! I can help you create various 3D objects. What would you like to generate today?',
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: false
      });
    } finally {
      this.isLoading = false;
    }

    //TODO: remove for later when implementation is finished
    //Adds mock SVGs
    this.generatedSvgCodes = this.getRemoteControlSvgs();
  }

  onSvgSelected(index: number): void {
    this.selectedSvgIndex = index;
  }

  //TODO: Delete was for mock up
  initializeMockConversation(): void {
    const mockConversation: ChatMessage[] = [
      {
        id: 1,
        text: 'Welcome to the Object Generator! I can help you create various 3D objects. What would you like to generate today?',
        isSystem: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        needMoreInformation: false
      },
      {
        id: 2,
        text: 'Can you create a wooden table with four legs?',
        isUser: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 29), // 29 minutes ago
        needMoreInformation: false
      },
      {
        id: 3,
        text: 'I\'ve created a wooden table with four legs. The table has a polished oak finish with classic design. Would you like to adjust any of the dimensions or materials?',
        isSystem: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 27), // 27 minutes ago
        needMoreInformation: false
      },
      {
        id: 4,
        text: 'Could you make the legs slightly thinner and change the wood to maple?',
        isUser: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 25), // 25 minutes ago
        needMoreInformation: false
      },
      {
        id: 5,
        text: 'I need more information about how much thinner you want the legs?',
        isSystem: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 23), // 23 minutes ago
        needMoreInformation: true
      }
    ];

    this.messages = mockConversation;
  }

  async sendMessage() {
    if (this.inputMessage.trim() === '') return;

    // Add user message to chat
    const userMessageId = this.messages.length + 1;
    this.messages.push({
      id: userMessageId,
      text: this.inputMessage,
      isUser: true,
      timestamp: new Date(),
      needMoreInformation: false
    });

    const userMessage = this.inputMessage;
    this.inputMessage = '';
    this.isLoading = true;

    try {
      const response = await this.chatService.sendMessage(userMessage);

      // Add API response to chat
      this.messages.push({
        id: userMessageId + 1,
        text: response.message,
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: response.needMoreInformation
      });

      if (response.sessionId) {
        this.chatService.setSessionId(response.sessionId);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      this.messages.push({
        id: userMessageId + 1,
        text: 'Sorry, there was an error processing your request. Please try again later.',
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: false
      });
    } finally {
      this.isLoading = false;
    }
  }

  restore(): void {
    console.log('Restore action triggered');
  }

  retry(): void {
    // Retry the last user message
    if (this.messages.length > 0) {
      const lastUserMessage = [...this.messages].reverse().find(m => m.isUser);
      if (lastUserMessage) {
        this.inputMessage = lastUserMessage.text;

        // Remove the last exchange (both user message and system response)
        const lastIndex = this.messages.findIndex(m => m.id === lastUserMessage.id);
        if (lastIndex !== -1) {
          this.messages = this.messages.slice(0, lastIndex);
        }
      }
    }
  }


      //Svg Mocks:
  getRemoteControlSvgs(): string[] {
    return [
      // Remote 1 - Modern Minimalist
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" width="100" height="300">
        <rect x="10" y="10" rx="20" ry="20" width="80" height="280" fill="#222" />
        <circle cx="50" cy="50" r="15" fill="#444" />
        <rect x="30" y="90" width="40" height="40" rx="5" ry="5" fill="#333" />
        <circle cx="35" cy="150" r="8" fill="#555" />
        <circle cx="65" cy="150" r="8" fill="#555" />
        <circle cx="35" cy="180" r="8" fill="#555" />
        <circle cx="65" cy="180" r="8" fill="#555" />
        <rect x="30" y="210" width="12" height="12" fill="#FF5252" />
        <rect x="58" y="210" width="12" height="12" fill="#4CAF50" />
        <rect x="30" y="240" width="40" height="40" rx="5" ry="5" fill="#333" />
      </svg>`,

      // Remote 2 - Classic TV
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" width="100" height="300">
        <rect x="10" y="10" rx="10" ry="10" width="80" height="280" fill="#444" />
        <circle cx="50" cy="40" r="12" fill="#222" stroke="#666" stroke-width="2" />
        <rect x="25" y="70" width="50" height="20" rx="3" ry="3" fill="#222" />
        <rect x="25" y="100" width="23" height="20" rx="3" ry="3" fill="#222" />
        <rect x="52" y="100" width="23" height="20" rx="3" ry="3" fill="#222" />
        <rect x="25" y="130" width="23" height="20" rx="3" ry="3" fill="#222" />
        <rect x="52" y="130" width="23" height="20" rx="3" ry="3" fill="#222" />
        <rect x="25" y="160" width="50" height="20" rx="3" ry="3" fill="#222" />
        <circle cx="35" cy="205" r="10" fill="#222" />
        <circle cx="65" cy="205" r="10" fill="#222" />
        <circle cx="35" cy="240" r="10" fill="#222" />
        <circle cx="65" cy="240" r="10" fill="#222" />
        <text x="50" y="245" font-size="8" text-anchor="middle" fill="#777">OK</text>
      </svg>`,

      // Remote 3 - Smart TV
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" width="100" height="300">
        <rect x="10" y="10" rx="15" ry="15" width="80" height="280" fill="#333" />
        <circle cx="50" cy="30" r="8" fill="#222" />
        <rect x="20" y="50" width="60" height="40" rx="5" ry="5" fill="#1a1a1a" />
        <circle cx="50" cy="120" r="20" fill="#222" stroke="#444" stroke-width="2" />
        <path d="M50 110 L50 130 M40 120 L60 120" stroke="#555" stroke-width="2" />
        <circle cx="30" cy="160" r="8" fill="#222" />
        <circle cx="50" cy="160" r="8" fill="#222" />
        <circle cx="70" cy="160" r="8" fill="#222" />
        <circle cx="30" cy="185" r="8" fill="#222" />
        <circle cx="50" cy="185" r="8" fill="#222" />
        <circle cx="70" cy="185" r="8" fill="#222" />
        <rect x="25" y="210" width="15" height="15" rx="3" fill="#E53935" />
        <rect x="43" y="210" width="15" height="15" rx="3" fill="#43A047" />
        <rect x="61" y="210" width="15" height="15" rx="3" fill="#1E88E5" />
        <rect x="25" y="235" width="15" height="15" rx="3" fill="#FDD835" />
        <rect x="43" y="235" width="15" height="15" rx="3" fill="#8E24AA" />
        <rect x="61" y="235" width="15" height="15" rx="3" fill="#FB8C00" />
      </svg>`,

      // Remote 4 - Streaming Device
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" width="100" height="300">
        <rect x="20" y="10" rx="30" ry="30" width="60" height="280" fill="#111" />
        <circle cx="50" cy="50" r="18" fill="#222" />
        <circle cx="50" cy="50" r="12" fill="#333" />
        <rect x="30" y="90" width="40" height="10" rx="3" ry="3" fill="#333" />
        <rect x="30" y="110" width="40" height="10" rx="3" ry="3" fill="#333" />
        <path d="M38 140 L50 150 L62 140" stroke="#444" stroke-width="3" fill="none" />
        <path d="M38 170 L50 160 L62 170" stroke="#444" stroke-width="3" fill="none" />
        <circle cx="50" cy="190" r="15" fill="#222" />
        <text x="50" y="193" font-size="10" text-anchor="middle" fill="#555">OK</text>
        <circle cx="50" cy="230" r="10" fill="#222" />
        <path d="M45 230 L55 230" stroke="#444" stroke-width="2" />
        <rect x="30" y="250" width="40" height="15" rx="5" ry="5" fill="#3949AB" />
        <text x="50" y="261" font-size="8" text-anchor="middle" fill="#ccc">HOME</text>
      </svg>`
    ];
  }
}
