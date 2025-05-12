import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgForOf, NgIf} from "@angular/common";
import {ReactiveFormsModule} from "@angular/forms";
import {ThreedViewerComponent} from "../../components/threed-viewer/threed-viewer.component";
import {ChatComponent} from "../../components/chat/chat.component";
import {Subscription} from "rxjs";
import {DrawingComponent} from "../../components/drawing/drawing.component";
import {IterationAgentService} from "../../services/iteration-agent.service";
import {ScadConvertService} from "../../services/scad-convert.service";
import {AnthropicIterationAgentService} from "../../services/anthropic-iteration-agent.service";
import {ThreeWithUploadComponent} from "../../components/three-with-upload/three-with-upload.component";
import {BaseMovementAgentService, MovementResponse} from "../../services/base-movement-agent.service";
import {DeepseekMovementAgentService} from "../../services/deepseek-movement-agent.service";
import {AnthropicMovementAgentService} from "../../services/anthropic-movement-agent.service";
import {PreviewGeneratorService, PreviewDesign} from "../../services/preview-generator.service";
import {PreviewCardComponent} from "../../components/preview-card/preview-card.component";

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
    PreviewCardComponent,
    NgForOf,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css'
})
export class MainComponent implements OnInit, OnDestroy{
  @ViewChild('threeComponent') threeComponent!: ThreeWithUploadComponent;
  @ViewChild(ChatComponent) chatComponent!: ChatComponent;

  buttonLayout: number[][] | null = null;
  previewCount: number = 4;

  currentButtonLayout: any = null;
  currentButtonParams: any = null;

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
  private currentSubscription: Subscription | null = null;

  generatedStlData: ArrayBuffer | null = null;

  currentMovementAgent!: BaseMovementAgentService;
  movementAction: MovementResponse | null = null;

  // Images
  showPreviewOptions: boolean = false;
  previewDesigns: PreviewDesign[] = [];
  selectedDesignId: string | null = null;
  usePreviewMode: boolean = false;
  showingPreviews: boolean = false;


  constructor(
    private iterationAgent: IterationAgentService,
    private anthropicIterationAgent: AnthropicIterationAgentService,
    private scadConvertService: ScadConvertService,
    private deepseekMovementAgent: DeepseekMovementAgentService,
    private anthropicMovementAgent: AnthropicMovementAgentService,
    private previewGeneratorService: PreviewGeneratorService
  ) {
    // Initialize the current movement agent based on the default model
    this.currentMovementAgent = this.useAnthropicModel ?
      this.anthropicMovementAgent :
      this.deepseekMovementAgent;

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

  // Update the ngAfterViewInit method
  ngAfterViewInit() {
    // Get button layout from the service if available
    this.buttonLayout = this.anthropicIterationAgent.getButtonLayout();

    // If button layout exists, pass it to the three component
    if (this.buttonLayout && this.threeComponent) {
      this.threeComponent.setButtonLayoutFromInput(this.buttonLayout);
    }
  }

  // Add this method to pass button layout to the component
  updateThreeComponentLayout() {
    // Update button layout from the most recent data
    this.buttonLayout = this.anthropicIterationAgent.getButtonLayout();

    // Pass to the component if available
    if (this.buttonLayout && this.threeComponent) {
      this.threeComponent.setButtonLayoutFromInput(this.buttonLayout);
    }
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

  onPreviewModeChanged(usePreview: boolean): void {
    this.usePreviewMode = usePreview;
  }

  setPreviewCount(count: number): void {
    this.previewCount = Math.min(Math.max(1, count), 5); // Limit between 1-5
  }

  switchTo3DViewer() {
    this.threeDAgent = true;
    this.isDrawing = false;
    this.modelEditor = false;
  }

  generateDesignPreviews(count: number = 3): void {
    this.isLoading = true;
    this.showPreviewOptions = true;
    this.previewDesigns = [];

    this.previewGeneratorService.generatePreviews(count).subscribe({
      next: (designs) => {
        this.previewDesigns = designs;
        this.isLoading = false;

        // Add system message about previews
        const previewMessage = {
          id: Date.now(),
          text: `Here are ${count} design options. Select one to generate the 3D model.`,
          isUser: false,
          isSystem: true,
          needMoreInformation: false,
          timestamp: new Date()
        };

        this.messages = [...this.messages, previewMessage];
      },
      error: (error) => {
        console.error('Error generating previews:', error);
        this.isLoading = false;
        this.showPreviewOptions = false;

        // Add error message
        const errorMessage = {
          id: Date.now(),
          text: 'There was an error generating design previews. Please try again.',
          isUser: false,
          isSystem: true,
          needMoreInformation: false,
          timestamp: new Date()
        };

        this.messages = [...this.messages, errorMessage];
      }
    });
  }


  private getActiveAgent() {
    return this.useAnthropicModel ? this.anthropicIterationAgent : this.iterationAgent;
  }

// Method to get the active movement agent
  getActiveMovementAgent(): BaseMovementAgentService {
    return this.useAnthropicModel ? this.anthropicMovementAgent : this.deepseekMovementAgent;
  }
  toggleModel(useClaudeModel?: boolean) {
    if (useClaudeModel !== undefined) {
      this.useAnthropicModel = useClaudeModel;
    } else {
      this.useAnthropicModel = !this.useAnthropicModel;
    }

    // Update the movement agent when switching models
    this.currentMovementAgent = this.getActiveMovementAgent();
  }

  onSendMessage(message: string): void {
    // First, always add the user message to the chat regardless of mode
    const userMessage = {
      id: Date.now(),
      text: message.trim(),
      isUser: true,
      needMoreInformation: false,
      timestamp: new Date()
    };

    this.messages = [...this.messages, userMessage];
    this.isLoading = true;
    this.isDrawing = false;
    this.threeDAgent = false;

    // Cancel any existing subscription
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
      this.currentSubscription = null;
    }

    // If in model editor mode, use movement agent
    if (this.modelEditor) {
      // Get the current movement agent
      const movementAgent = this.getActiveMovementAgent();

      // Process the movement instruction
     this.currentSubscription = movementAgent.processMovementInstruction(message).subscribe({
        next: (response) => {
          // Apply the movement to the 3D model
          this.movementAction = response;

          // Add response to chat
          const responseMessage = {
            id: Date.now() + 1,
            text: response.description,
            isUser: false,
            isSystem: true,
            needMoreInformation: false,
            timestamp: new Date()
          };

          this.messages = [...this.messages, responseMessage];
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error processing movement instruction:', error);
          this.isLoading = false;

          // Add error message
          const errorMessage = {
            id: Date.now() + 1,
            text: 'Sorry, I couldn\'t process that movement instruction.',
            isUser: false,
            isSystem: true,
            needMoreInformation: false,
            timestamp: new Date()
          };

          this.messages = [...this.messages, errorMessage];
        }
      });
    } else {
      // Get the appropriate agent
      const agent = this.getActiveAgent();

      if(this.usePreviewMode) {
        message = message + ` -- make ${this.previewCount} design previews.`;
      }

      // Send message to agent
      agent.sendMessage(message)
        .then((response) => {
          // Handle response differently based on preview mode
          if (this.usePreviewMode) {
            this.processAgentResponseWithPreview(response);
          } else {
            this.processAgentResponse(response);
          }
        })
        .catch((error) => {
          console.error('Error sending message:', error);
          this.isLoading = false;

          // Add error message
          const errorMessage = {
            id: Date.now() + 1,
            text: 'Sorry, there was an error processing your message.',
            isUser: false,
            isSystem: true,
            needMoreInformation: false,
            timestamp: new Date()
          };

          this.messages = [...this.messages, errorMessage];
        });

    }
  }

  cancelAiResponse(): void {
    // Access your chat service and cancel the request
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
      this.currentSubscription = null;
    }

    // Reset loading state
    this.isLoading = false;
  }

  // Add this method to handle responses when in preview mode
// Update this method to handle responses when in preview mode
  private processAgentResponseWithPreview(response: any) {
    const agent = this.getActiveAgent();
    this.isLoading = false;


    // Get the actual message text
    const messageText = response.message || '';

    // Process the response to extract SCAD parameters
    const processedResponse = agent.extractScadParameters(messageText);

    // Store the parameters if available
    if (processedResponse.buttonLayout) {
      agent.setButtonLayout(processedResponse.buttonLayout);
      this.currentButtonLayout = processedResponse.buttonLayout;
      console.log('Button layout:', this.currentButtonLayout);
    }

    if (processedResponse.buttonParams) {
      agent.setButtonParams(processedResponse.buttonParams);
      this.currentButtonParams = processedResponse.buttonParams;
      console.log('Button params:', this.currentButtonParams);
    }


    // Extract any JSON designs from the message
    try {
      // Look for JSON in the message - typically bounded by ```json and ```
      const jsonMatch = messageText.match(/```json([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : null;

      if (jsonString) {
        const designData = JSON.parse(jsonString);
        console.log('Extracted design data:', designData);

        // Send the extracted design data to the preview generator
        this.showingPreviews = true;
        this.isLoading = true;

        // Use the preview generator service to process the JSON
        this.previewGeneratorService.generatePreviewsFromJson(designData, this.previewCount).subscribe({
          next: (designs) => {
            this.previewDesigns = designs;
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error generating previews from JSON:', error);
            this.isLoading = false;

            // Add error message
            const errorMessage = {
              id: Date.now(),
              text: 'There was an error generating design previews. Please try again.',
              isUser: false,
              isSystem: true,
              needMoreInformation: false,
              timestamp: new Date()
            };

            this.messages = [...this.messages, errorMessage];
          }
        });
      }
      // Fallback to using extracted parameters if no JSON found
      else if (processedResponse.buttonLayout && processedResponse.buttonParams) {
        this.showingPreviews = true;
        this.generateDesignPreviews(this.previewCount);
      } else {
        this.isLoading = false;
      }
    } catch (error) {
      console.error('Error processing JSON from message:', error);

      // Fallback to using extracted parameters
      if (processedResponse.buttonLayout && processedResponse.buttonParams) {
        this.showingPreviews = true;
        this.generateDesignPreviews(this.previewCount);
      } else {
        this.isLoading = false;
      }
    }
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

// Handle design selection
  onDesignSelected(designId: string): void {
    this.selectedDesignId = designId;
    this.isLoading = true;

    // Find the corresponding design object from the previewDesigns array
    const selectedDesign = this.previewDesigns.find(design => design.id === designId);

    if (!selectedDesign) {
      console.error('Selected design not found');
      this.isLoading = false;
      return;
    }

    // Pass both the designId and the full design object
    this.previewGeneratorService.generateStlFromDesign(designId, selectedDesign).subscribe({
      next: (response: Blob) => {
        console.log('3D model generated successfully');

        response.arrayBuffer().then(buffer => {
          this.generatedStlData = buffer;
        });

        this.modelUrl = window.URL.createObjectURL(response);
        this.showingPreviews = false;
        this.threeDAgent = true;

        // Add system message about model generation
        const modelMessage = {
          id: Date.now(),
          text: 'Your selected 3D model has been generated. You can view and interact with it now.',
          isUser: false,
          isSystem: true,
          needMoreInformation: false,
          timestamp: new Date()
        };

        this.messages = [...this.messages, modelMessage];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error generating selected 3D model:', error);
        this.isLoading = false;

        // Add error message
        const errorMessage = {
          id: Date.now(),
          text: 'There was an error generating your selected 3D model. Please try again.',
          isUser: false,
          isSystem: true,
          needMoreInformation: false,
          timestamp: new Date()
        };

        this.messages = [...this.messages, errorMessage];
      }
    });
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


    // Generate design previews if we're in preview mode and have the necessary parameters
    if (this.usePreviewMode && processedResponse.buttonLayout && processedResponse.buttonParams) {
      // Store parameters for later use
      this.currentButtonLayout = processedResponse.buttonLayout;
      this.currentButtonParams = processedResponse.buttonParams;

      // Generate 3 previews by default (or use a configurable count)
      this.generateDesignPreviews(3);
    }
    // Otherwise generate 3D model directly if we have parameters
    else if (processedResponse.buttonLayout && processedResponse.buttonParams) {
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

    this.buttonLayout = buttonLayout;

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

          response.arrayBuffer().then(buffer => {
            this.generatedStlData = buffer;
            console.log('Generated STL data:', this.generatedStlData);
          })

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

  }

  async sendMessageToMovementAgent(message: string): Promise<void> {
    if (!this.threeComponent) {
      console.error('No three component available');
      return;
    }

    // Use a public method to check if the base mesh exists
    if (!this.threeComponent.hasBaseMesh()) {
      console.error('No base mesh available for the agent to reference');
      return;
    }

    // Get the model context using a public method
    const modelContext = this.threeComponent.getModelContext();

    // Combine the user message with the context information
    const fullPrompt = `
USER REQUEST: ${message}

MODEL CONTEXT: ${JSON.stringify(modelContext, null, 2)}
  `;

    try {
      // Convert the Observable to a Promise for async/await usage
      const agentResponse = await this.currentMovementAgent.processMovementInstruction(fullPrompt).toPromise();

      if (!agentResponse) {
        console.error('Empty response from move agent');
        return;
      }

      // Apply the movement response directly (it's already the correct type)
      this.threeComponent.applyMovementAction(agentResponse);

    } catch (error) {
      console.error('Error processing agent response:', error);
    }
  }

  onSwitchToDrawing() {
    this.threeDAgent = false;
    this.isDrawing = true;
    this.modelEditor = false;
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
