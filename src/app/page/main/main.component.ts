import {Component, OnDestroy, OnInit} from '@angular/core';
import {NgIf} from "@angular/common";
import {ReactiveFormsModule} from "@angular/forms";
import {ThreedViewerComponent} from "../../components/threed-viewer/threed-viewer.component";
import {ChatComponent} from "../../components/chat/chat.component";
import {Subscription} from "rxjs";
import {DrawingComponent} from "../../components/drawing/drawing.component";
import {IterationAgentService} from "../../services/iteration-agent.service";
import {ScadConvertService} from "../../services/scad-convert.service";
import {AnthropicIterationAgentService} from "../../services/anthropic-iteration-agent.service";
import {ThreeWithUploadComponent} from "../../components/three-with-upload/three-with-upload.component";

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
    ThreeWithUploadComponent,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css'
})
export class MainComponent implements OnInit, OnDestroy{
  useAnthropicModel = false;

  messages: any[] = [];
  isLoading = false;
  isSpeaking = false;
  isRecording = false;
  threeDAgent = false;
  modelEditor = false;
  isDrawing = true;
  modelUrl: string | null = null;

  private subscriptions: Subscription[] = [];
  private speechSynthesis: SpeechSynthesis | null = null;
  private speechRecognition: any = null;

  constructor(private iterationAgent: IterationAgentService, private anthropicIterationAgent: AnthropicIterationAgentService, private scadConvertService: ScadConvertService) {
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

  private getActiveAgent() {
    return this.useAnthropicModel ? this.anthropicIterationAgent : this.iterationAgent;
  }

  toggleModel(useClaudeModel?: boolean) {
    if (useClaudeModel !== undefined) {
      this.useAnthropicModel = useClaudeModel;
    } else {
      this.useAnthropicModel = !this.useAnthropicModel;
    }
  }

  onSendMessage(message: string): void {
    const agent = this.getActiveAgent();

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
    agent.sendMessage(message)
      .then(response => {
        this.isLoading = false;

        // Process the response to extract SCAD parameters
        const processedResponse = agent.extractScadParameters(response.message || '');

        // Store the parameters in the service if needed
        if (processedResponse.buttonLayout) {
          agent.setButtonLayout(processedResponse.buttonLayout);
        }

        if (processedResponse.buttonParams) {
          agent.setButtonParams(processedResponse.buttonParams);
        }

        // Add the response to messages
        const responseMessage = {
          id: Date.now() + 1,
          text: processedResponse.cleanedResponse,
          isUser: false,
          isSystem: true,
          needMoreInformation: false,
          timestamp: new Date()
        };

        this.messages = [...this.messages, responseMessage];
        this.handleResponseActions(response);

        // Generate 3D model if we have the necessary parameters
        if (processedResponse.buttonLayout && processedResponse.buttonParams) {
          this.generateAndShow3DModel(processedResponse.buttonLayout, processedResponse.buttonParams);
        } else {
          this.isLoading = false;
        }
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
    const agent = this.getActiveAgent();
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

    // Check if we're using Anthropic and handle accordingly
    if (this.useAnthropicModel) {
      // For Anthropic, use proper image support
      this.anthropicIterationAgent.sendMessageWithImage('Please analyze this drawing and create a button layout from it.', imageData)
        .then(this.processAgentResponse.bind(this))
        .catch(error => {
          console.error('Error sending drawing to Anthropic:', error);
          this.isLoading = false;
        });
    } else {
      // Fallback to text-only method for other models
      agent.sendMessage(`[User sent a drawing: ${imageData.substring(0, 30)}...]`)
        .then(this.processAgentResponse.bind(this))
        .catch(error => {
          console.error('Error sending drawing:', error);
          this.isLoading = false;
        });
    }
  }

// Extract the common response handling logic to avoid duplication
  private processAgentResponse(response: any) {
    const agent = this.getActiveAgent();
    this.isLoading = false;

    // Get the actual message text, accounting for different API response structures
    const messageText = response.message || '';

    // Process the response to extract SCAD parameters
    const processedResponse = agent.extractScadParameters(messageText);

    // Store the parameters in the service if needed
    if (processedResponse.buttonLayout) {
      agent.setButtonLayout(processedResponse.buttonLayout);
    }

    if(processedResponse.buttonParams) {
      agent.setButtonParams(processedResponse.buttonParams);
    }

    // Add the response to messages with cleaned text
    const responseMessage = {
      id: Date.now() + 1,
      text: processedResponse.cleanedResponse || messageText,
      isUser: false,
      isSystem: true,
      needMoreInformation: false,
      timestamp: new Date()
    };

    this.messages = [...this.messages, responseMessage];

    // Generate 3D model if we have the necessary parameters
    if (processedResponse.buttonLayout && processedResponse.buttonParams) {
      this.generateAndShow3DModel(processedResponse.buttonLayout, processedResponse.buttonParams);
    } else {
      this.isLoading = false;
    }
  }

  generateAndShow3DModel(buttonLayout: any, buttonParams: any): void {
    if (!buttonLayout || !buttonParams) {
      console.error('Cannot generate 3D model: missing parameters');
      return;
    }

    // Keep loading state active
    this.isLoading = true;

    // Set up the 3D viewer
    this.threeDAgent = true;
    this.isDrawing = false;

    // Format the button layout as expected by the service
    const formattedComponents = buttonLayout.map((button: number[], index: number) => ({
      id: `button_${index}`,
      type: 'button',
      x: button[0],
      y: button[1],
      size: button[2],
      width: button.length > 3 ? button[3] : 0 // Use width if provided, otherwise default to 0
    }));

    // Format button parameters as expected
    const formattedParams = {
      case_width: buttonParams[0],
      case_depth: buttonParams[1],
      wall_thickness: buttonParams[2],
      corner_radius: buttonParams[3],
      top_thickness: buttonParams[4],
      button_size: buttonParams[5],
      edge_margin: buttonParams[6],
      lip_height: buttonParams[7],
      lip_clearance: buttonParams[8],
      case_height: buttonParams[9]
    };

    // Call the SCAD converter service
    this.scadConvertService.convertToScad(formattedComponents, formattedParams)
      .subscribe({
        next: (response: Blob) => {
          // Process successful response
          console.log('3D model generated successfully');

          // Create object URL for the 3D model
          this.modelUrl = window.URL.createObjectURL(response);

          // Add system message about model generation
          const modelMessage = {
            id: Date.now(),
            text: 'Your 3D model has been generated. You can view and interact with it now.',
            isUser: false,
            isSystem: true,
            needMoreInformation: false,
            timestamp: new Date()
          };

          this.messages = [...this.messages, modelMessage];

          // Set loading to false
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('Error generating 3D model:', error);

          // Add error message to chat
          const errorMessage = {
            id: Date.now(),
            text: 'There was an error generating your 3D model. Please try again.',
            isUser: false,
            isSystem: true,
            needMoreInformation: false,
            timestamp: new Date()
          };

          this.messages = [...this.messages, errorMessage];

          // Set loading to false
          this.isLoading = false;
        }
      });
  }

  // Switch to editor
  onSwitchToModelEditor(): void {
    this.useAnthropicModel = false;

    // Keep the 3D view active
    this.threeDAgent = false;
    this.isDrawing = false;
    this.modelEditor = true;


    // Optionally, add a message to the chat history
    const systemMessage = {
      id: Date.now(),
      text: 'Switched to 3D model editing mode. You can now make changes to your model.',
      isUser: false,
      isSystem: true,
      needMoreInformation: false,
      timestamp: new Date()
    };

    this.messages = [...this.messages, systemMessage];

  }

  extractModelGeometry(): any {
    // Logic to extract the base model geometry from the current 3D model
    // This is a placeholder and should be replaced with actual extraction logic
    return {
      width: 100,
      height: 50,
      depth: 30,
      components: []
    };
  }

}
