// chat.component.ts
import { Component, OnInit } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {SvgviewerComponent} from "../../components/svgviewer/svgviewer.component";
import {ThreedViewerComponent} from "../../components/threed-viewer/threed-viewer.component";
import { MarkdownModule } from 'ngx-markdown';
import {BaseChatAgentService, ChatMessage, ChatOption} from "../../services/base-chat-agent.service";
import {ConsultantService} from "../../services/consultant.service";
import {SvgAgentService} from "../../services/svg-agent.service";
import {ScadConvertService} from "../../services/scad-convert.service";

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
  selectedSvgIndex: number = 0;
  isLoading: boolean = false;
  isRecording = false;
  recognition: any;
  lastInputWasVoice = false;
  speechSynthesis: SpeechSynthesis = window.speechSynthesis;
  isSpeaking = false;

  // Agent selection properties
  activeAgentType: string = 'consultant';
  currentAgent: BaseChatAgentService;

  // SVG content if needed
  generatedSvgCodes: { id: number, code: string, name: string }[] = [];


  // Agent properties
  showPreview = false;
  svgAgent = false;
  threeDAgent = false;

  //For Testing SVG
  svgTest = false;
  testScad = false;
  testInProgress = false;
  //TODO: Instead of this being test later will change it to take the repose from the consultant agent and send it to the SVG agent.
  testProjectData = {
    "project_name": "WASD Keyboard",
    "object_type": "interface",
    "primary_function": "Gaming keyboard with only WASD keys",
    "user_preferences": {
      "size_preference": "compact",
      "style_preference": "modern",
      "key_features": ["WASD keys"]
    },
    "template_candidates": ["rectangle", "square", "Circle"],
    "constraints": ["no more than 5 keys", "no additional features"],
    "special_requests": ["none"]
  };

  //For 3D viewer
  modelUrl: string | null = null;



  constructor(private consultantService: ConsultantService,
              private svgAgentService: SvgAgentService,
              private scadConvertService: ScadConvertService)
  {
    this.currentAgent = this.consultantService
  }

  async ngOnInit() {
    this.initSpeechRecognition();
    this.loadVoices();

    this.messages = [];

    this.svgTest = false;

    if(this.svgTest) {
      this.runSvgTest();
    }

    this.testScad = true;

    if(this.testScad){
      this.testScadConversion();
    }
  }

  // VOICE RECOGNITION - PART
  private initSpeechRecognition() {
    // Browser compatibility check
    const SpeechRecognition = (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.inputMessage = this.inputMessage ? this.inputMessage + ' ' + transcript : transcript;
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.isRecording = false;
      };

      this.recognition.onend = () => {
        this.isRecording = false;
      };
    }
  }

  // toggleVoiceRecognition method
  toggleVoiceRecognition() {
    if (!this.recognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    if (this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
    } else {
      this.lastInputWasVoice = true; // Mark that this input was from voice
      this.recognition.start();
      this.isRecording = true;
    }
  }

  // Method to read response aloud
  readResponseAloud(text: string): void {
    // Stop any current speech
    this.speechSynthesis.cancel();

    // Clean up text for speech - remove code blocks, Markdown formatting, etc.
    const cleanText = this.cleanTextForSpeech(text);

    // Create a new speech utterance
    const speech = new SpeechSynthesisUtterance(cleanText);

    // Get available voices
    const voices = this.speechSynthesis.getVoices();

    // Find the best Google voice
    // First try to find Google voices
    let bestVoice = voices.find(voice =>
      voice.name.includes('Google') && (voice.lang.startsWith('en-') || voice.lang.startsWith('en-GB')) || voice.lang === 'en');

    // If no English Google voice, try any English voice
    if (!bestVoice) {
      bestVoice = voices.find(voice =>
        (voice.lang.startsWith('en-') || voice.lang === 'en')
      );
    }

    if(!bestVoice) {
      bestVoice = voices.find(voice => voice.name.includes('Google'));
    }
    // Set the voice if found
    if (bestVoice) {
      speech.voice = bestVoice;
      speech.lang = bestVoice.lang; // Ensure language matches the voice
      console.log('Using voice:', bestVoice.name, 'Language:', bestVoice.lang);
    } else {
      // Fallback - explicitly set to English
      speech.lang = 'en-US';
    }

    // Optional: Configure voice properties
    speech.volume = 1;
    speech.rate = 0.95;
    speech.pitch = 1.05;

    // Add event handlers
    speech.onstart = () => {
      this.isSpeaking = true;
    };

    speech.onend = () => {
      this.isSpeaking = false;
    };

    speech.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
    };

    // Speak the text
    this.speechSynthesis.speak(speech);
  }

  // Add loadVoices method to initialize voices when they become available
  private loadVoices(): void {
    if (this.speechSynthesis.getVoices().length > 0) {
      console.log(`${this.speechSynthesis.getVoices().length} voices already loaded`);
    }

    if (this.speechSynthesis.onvoiceschanged !== undefined) {
      this.speechSynthesis.onvoiceschanged = () => {
        console.log(`Loaded ${this.speechSynthesis.getVoices().length} voices`);
      };
    }
  }

  // Helper method to clean text for speech
  cleanTextForSpeech(text: string): string {
    // Remove code blocks
    let cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted.');

    // Remove Markdown formatting
    cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    cleanText = cleanText.replace(/\*(.*?)\*/g, '$1');     // Italic
    cleanText = cleanText.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links

    // Remove other markdown elements
    cleanText = cleanText.replace(/#+\s/g, '');  // Headers
    cleanText = cleanText.replace(/`(.*?)`/g, '$1'); // Inline code

    // Remove emojis - this covers most common Unicode emoji ranges
    cleanText = cleanText.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');


    return cleanText;
  }


  // CHAT MESSAGE SENDING
  async sendMessage() {
    if (this.inputMessage.trim() === '') return;

    const userMessage = this.inputMessage.trim();
    this.inputMessage = '';

    // Add user message to chat
    this.messages.push({
      id: this.messages.length,
      text: userMessage,
      isUser: true,
      timestamp: new Date(),
      needMoreInformation: false
    });

    this.isLoading = true;

    try {
      // Use the current agent to process the message
      const response = await this.currentAgent.sendMessage(userMessage);

      // Try to parse options from the response
      let parsedOptions: ChatOption[] | undefined;
      let messageText = response.message;

      try {
        // Look for JSON structure in the response
        const jsonMatch = response.message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          if (jsonData.question && jsonData.options) {
            messageText = jsonData.question;
            parsedOptions = jsonData.options; // This is the parsed options - this is where we should get all the information so we can hover effect that tells description.
          }
        }
      } catch (parseError) {
        console.log('No valid JSON options found in response');
      }

      // Add response to chat
      this.messages.push({
        id: this.messages.length,
        text: messageText,
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: response.needMoreInformation,
        options: parsedOptions
      });

    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message to chat
      this.messages.push({
        id: this.messages.length,
        text: 'Sorry, there was an error processing your request.',
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: false
      });
    } finally {
      this.isLoading = false;
    }
  }

  selectOption(option: ChatOption, message: ChatMessage) {
    // Handle the selection
    console.log(`Selected option: ${option.label} (ID: ${option.id})`);

    // If "submit" option is selected, switch to SVG agent
    //TODO: Make sure it saves the last respond it gets from the consultant agent. to send to the with the SVG agent.
    // MAke this an await so it changes the layout but waits for the response to get back so it can send it with the SVG agent.
    if (option.label.toLowerCase().includes('submit')) {
      // Add user's selection as a message in the chat display
      this.messages.push({
        id: this.messages.length,
        text: `Selected: ${option.label}`,
        isUser: true,
        timestamp: new Date(),
        needMoreInformation: false
      });

      this.activeAgentType = 'svg';
      this.currentAgent = this.svgAgentService;
      this.svgAgent = true;
      this.threeDAgent = false;
      this.showPreview = true;

      // Add a transition message
      this.messages.push({
        id: this.messages.length,
        text: "Switching to SVG generation mode. How can I help you create SVG graphics?",
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: false
      });
    } else {
      // For other options, manually add the message and send directly to agent
      // Add user's selection as a message in the chat display
      this.messages.push({
        id: this.messages.length,
        text: `Selected: ${option.label}`,
        isUser: true,
        timestamp: new Date(),
        needMoreInformation: false
      });

      this.isLoading = true;


      //TODO: Fix so we dont got 26 lines of redundant code....
      // Send the option ID directly to the agent without calling sendMessage()
      this.currentAgent.sendMessage(`${option.id}`)
        .then(response => {
          // Process the response similar to sendMessage()
          let parsedOptions: ChatOption[] | undefined;
          let messageText = response.message;

          try {
            // Look for JSON structure in the response
            const jsonMatch = response.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonData = JSON.parse(jsonMatch[0]);
              if (jsonData.question && jsonData.options) {
                messageText = jsonData.question;
                parsedOptions = jsonData.options;
              }
            }
          } catch (parseError) {
            console.log('No valid JSON options found in response');
          }

          // Add response to chat
          this.messages.push({
            id: this.messages.length,
            text: messageText,
            isSystem: true,
            timestamp: new Date(),
            needMoreInformation: response.needMoreInformation,
            options: parsedOptions
          });
        })
        .catch(error => {
          console.error('Error sending message:', error);
          // Add error message to chat
          this.messages.push({
            id: this.messages.length,
            text: 'Sorry, there was an error processing your request.',
            isSystem: true,
            timestamp: new Date(),
            needMoreInformation: false
          });
        })
        .finally(() => {
          this.isLoading = false;
        });
    }
  }

  // SVG Viewer PART
  // TODO: Make this the main method that actually uses this for when we change to the SVG agent.
  // Testing Methods
  runSvgTest() {
    if (!this.svgTest) return;

    // Reset any existing state
    this.generatedSvgCodes = [];

    // Set agent to SVG mode
    this.activeAgentType = 'svg';
    this.currentAgent = this.svgAgentService;
    this.svgAgent = true;
    this.threeDAgent = false;
    this.showPreview = true;
    this.testInProgress = true;

    // Format the test project data
    const projectDataString = JSON.stringify(this.testProjectData, null, 2);
    const userMessage = `Here's the project information:\n\`\`\`json\n${projectDataString}\n\`\`\``;

    // Call the SVG agent service without adding messages to UI
    this.svgAgentService.sendMessage(userMessage)
      .then(response => {
        // Process the response and extract SVG code
        this.testInProgress = false;

        // Extract SVG code from the response
        this.extractSvgCodesFromResponse(response.message);

        // If no SVGs found, show error message
        if (this.generatedSvgCodes.length === 0) {
          this.messages.push({
            id: this.messages.length,
            text: 'No SVG designs were found in the response.',
            isSystem: true,
            timestamp: new Date(),
            needMoreInformation: false
          });
        }
      })
      .catch(error => {
        console.error('Error getting response from SVG agent:', error);
        this.testInProgress = false;

        // Add error message to chat only on failure
        this.messages.push({
          id: this.messages.length,
          text: 'Sorry, there was an error generating SVG designs.',
          isSystem: true,
          timestamp: new Date(),
          needMoreInformation: false
        });
      });
  }

  extractSvgCodesFromResponse(response: string) {
    // Find all SVG code blocks in the response
    const svgRegex = /<svg[\s\S]*?<\/svg>/g;
    const svgMatches = response.match(svgRegex);

    if (svgMatches && svgMatches.length > 0) {
      // Process the SVG codes for the viewer
      this.generatedSvgCodes = svgMatches.map((code, index) => {
        return {
          id: index,
          code: code,
          name: `Design ${index + 1}`
        };
      });

      console.log(`Found ${this.generatedSvgCodes.length} SVG designs in the response`);
    } else {
      console.log('No SVG code found in the response');
    }
  }

  onSvgSelected(index: number): void {
    this.selectedSvgIndex = index;
  }


  // 3D VIEWER PART
 //Test method with predefined parameters.
// New method to convert SVG component data to SCAD
  convertLastSvgResponseToScad(): void {
    // Find the last system message from the SVG agent
    const lastSvgMessage = [...this.messages]
      .reverse()
      .find(msg => msg.isSystem && this.svgAgent);

    if (!lastSvgMessage) {
      console.error('No SVG agent responses found');
      return;
    }

    try {
      // Try to extract component data from the message
      const componentsMatch = lastSvgMessage.text.match(/\"components\"\s*:\s*\[([\s\S]*?)\]/);

      if (!componentsMatch) {
        console.error('No component data found in the message');
        return;
      }

      // Parse the components JSON
      const componentsString = `[${componentsMatch[1]}]`;
      const components = JSON.parse(componentsString);

      console.log('Extracted components:', components);

      // Convert and send to backend
      this.scadConvertService.convertToScad(components)
        .subscribe({
          next: (response: Blob) => {
            console.log('SCAD conversion successful');
            // Handle the response (e.g., save file, show preview)
            this.handleScadResponse(response);
          },
          error: (error) => {
            console.error('Error converting to SCAD:', error);
          }
        });
    } catch (error) {
      console.error('Error processing SVG response:', error);
    }
  }

// Handle SCAD response
  private handleScadResponse(response: Blob): void {
    // Create object URL for the 3D model
    const url = window.URL.createObjectURL(response);

    // Log print preparation message
    console.log('Starting to render 3D model for printing...');

    // Set properties to display in 3D viewer
    this.showPreview = true;
    this.threeDAgent = true;
    this.svgAgent = false;

    // Pass the model URL to the 3D viewer component
    // You'll need to add a modelUrl property to your component
    this.modelUrl = url;

    // Add a message to the chat indicating the model is ready
    this.messages.push({
      id: this.messages.length,
      text: 'Your 3D model has been created and is ready for preview. You can now view it in the 3D viewer.',
      isSystem: true,
      timestamp: new Date(),
      needMoreInformation: false
    });

    // Optional: Add a download button if users want to save the file later
    // You could implement this as a separate method or add a property to show a download button
  }

  // Test method for SCAD conversion with mock data
  testScadConversion(): void {
    // Mock component data
    const mockComponents = [
      {"id": "button1", "type": "button", "x": 5, "y": 15, "size": 12},
      {"id": "button2", "type": "button", "x": 35, "y": 25, "size": 18},
      {"id": "button3", "type": "button", "x": 65, "y": 15, "size": 10},
      {"id": "slider1", "type": "slider", "x": 20, "y": 50, "size": 30} // This should be ignored as it's not a button
    ];

    console.log('Testing SCAD conversion with mock components:', mockComponents);

    // Send to the SCAD converter service
    this.scadConvertService.convertToScad(mockComponents)
      .subscribe({
        next: (response: Blob) => {
          console.log('SCAD conversion successful');
          // Handle the response
          this.handleScadResponse(response);
        },
        error: (error) => {
          console.error('Error converting to SCAD:', error);
        }
      });
  }
}
