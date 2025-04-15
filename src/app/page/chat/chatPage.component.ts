// chatPage.component.ts
import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {SvgviewerComponent} from "../../components/svgviewer/svgviewer.component";
import {ThreedViewerComponent} from "../../components/threed-viewer/threed-viewer.component";
import { MarkdownModule } from 'ngx-markdown';
import {BaseChatAgentService, ChatMessage, ChatOption} from "../../services/base-chat-agent.service";
import {ConsultantService} from "../../services/consultant.service";
import {SvgAgentService} from "../../services/svg-agent.service";
import {ScadConvertService} from "../../services/scad-convert.service";
import {ChatService} from "../../services/chat.service";
import {Subscription} from "rxjs";
import {ChatComponent} from "../../components/chat/chat.component";

@Component({
  selector: 'app-chat-page',
  templateUrl: './chatPage.component.html',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    NgForOf,
    NgIf,
    SvgviewerComponent,
    ThreedViewerComponent,
    MarkdownModule,
    ChatComponent,
  ]
})
export class ChatPageComponent implements OnInit, OnDestroy {
  messages: any[] = [];
  isLoading = false;
  isSpeaking = false;
  isRecording = false;
  showPreview = false;
  svgAgent = false;
  threeDAgent = false;
  testInProgress = false;
  generatedSvgCodes: any[] = [];
  selectedSvgIndex = 0;
  modelUrl: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private chatService: ChatService,
    private scadConvertService: ScadConvertService,
    private svgAgentService: SvgAgentService
  ) {}

  ngOnInit(): void {
    // Subscribe to chat service updates
    this.subscriptions.push(
      this.chatService.messages$.subscribe(messages => this.messages = messages),
      this.chatService.loading$.subscribe(loading => this.isLoading = loading),
      this.chatService.speaking$.subscribe(speaking => this.isSpeaking = speaking)
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onSendMessage(message: string): void {
    this.chatService.sendMessage(message).subscribe({
      next: response => {
        this.chatService.receiveMessage(response);
        this.handleResponseActions(response);
      },
      error: error => {
        console.error('Error sending message:', error);
        this.isLoading = false;
      }
    });
  }

  onOptionSelected(event: {option: any, message: any}): void {
    const { option, message } = event;
    // Handle option selection based on your application logic
    console.log('Option selected:', option, 'for message:', message);
  }

  onSpeakText(text: string): void {
    this.chatService.readResponseAloud(text);
  }

  onToggleRecording(): void {
    this.chatService.toggleVoiceRecognition();
    this.isRecording = !this.isRecording;
  }

  onSvgSelected(index: number): void {
    this.selectedSvgIndex = index;
  }

  onSvgClicked(index: number): void {
    const selectedSvg = this.generatedSvgCodes[index];
    if (!selectedSvg) return;

    this.isLoading = true;

    // Send message to get component data for the selected SVG
    const prompt = `Please provide the component data for SVG design ${index + 1} in JSON format.
               Include layout_options with components having id, type, x, y, and size properties.`;

    // Send to SVG agent without showing in chat
    this.svgAgentService.sendMessage(prompt)
      .then(response => {
        this.isLoading = false;

        // Try to extract JSON from the response
        try {
          // Look for complete JSON objects in the response
          const jsonBlocks = this.findCompleteJsonObjects(response.message);
          console.log('JSON blocks found:', jsonBlocks);

          // Find the one with layout_options
          const layoutBlock = jsonBlocks.find(block => {
            try {
              const parsed = JSON.parse(block);
              return parsed.layout_options && Array.isArray(parsed.layout_options);
            } catch (e) {
              return false;
            }
          });

          if (layoutBlock) {
            const layoutOptions = JSON.parse(layoutBlock);
            console.log('Extracted layout options:', layoutOptions);

            // Process the first layout option (or add UI to let user choose)
            if (layoutOptions.layout_options && layoutOptions.layout_options.length > 0) {
              // Get the first layout option's components
              const components = layoutOptions.layout_options[0].components;
              this.convertComponentsToScad(components);
            }
          } else {
            console.error('No valid layout options found in response');
          }
        } catch (error) {
          console.error('Error processing layout data:', error);
        }
      })
      .catch(error => {
        this.isLoading = false;
        console.error('Error getting component data:', error);
      });
  }

  private handleResponseActions(response: any): void {
    // Handle any special actions from the response
    if (response.action === 'showSvg') {
      this.showPreview = true;
      this.svgAgent = true;
      this.threeDAgent = false;

      if (response.svgCodes && response.svgCodes.length > 0) {
        this.generatedSvgCodes = response.svgCodes;
        this.selectedSvgIndex = 0;
      }
    } else if (response.action === 'show3D') {
      this.showPreview = true;
      this.threeDAgent = true;
      this.svgAgent = false;
    }
  }

  private convertComponentsToScad(components: any[]): void {
    if (!components || components.length === 0) {
      console.error('No components to convert');
      return;
    }

    // Filter out non-button components if needed
    const buttonComponents = components.filter(comp => comp.type === 'button');

    if (buttonComponents.length === 0) {
      console.error('No button components found');
      return;
    }

    console.log('Converting components to SCAD:', buttonComponents);

    // Set up the 3D viewer before making the request
    this.showPreview = true;
    this.threeDAgent = true;
    this.svgAgent = false;

    // Send to the SCAD converter service
    this.scadConvertService.convertToScad(buttonComponents)
      .subscribe({
        next: (response: Blob) => {
          console.log('SCAD conversion successful');
          this.handleScadResponse(response);
        },
        error: (error: any) => {
          console.error('Error converting to SCAD:', error);
        }
      });
  }

  private handleScadResponse(response: Blob): void {
    // Create object URL for the 3D model
    const url = window.URL.createObjectURL(response);

    // Log print preparation message
    console.log('Starting to render 3D model for printing...');

    // Pass the model URL to the 3D viewer component
    this.modelUrl = url;

    // Save the STL file
    this.chatService.saveStlFile(response);

    // Add a message to the chat indicating the model is ready
    this.messages.push({
      id: this.messages.length,
      text: 'Your 3D model has been created and is ready for preview. You can now view it in the 3D viewer. The STL file has also been saved to your downloads.',
      isSystem: true,
      timestamp: new Date(),
      needMoreInformation: false
    });
  }

  // Helper method to extract JSON objects from text
  private findCompleteJsonObjects(text: string): string[] {
    const jsonObjects: string[] = [];
    let braceCount = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceCount === 0) {
          start = i;
        }
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && start !== -1) {
          jsonObjects.push(text.substring(start, i + 1));
          start = -1;
        }
      }
    }

    return jsonObjects;
  }


}
