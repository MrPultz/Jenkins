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

  // Add this property to store the current session ID at the component level
  private currentSessionId: string | undefined;

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

    this.testScad = false;

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
      // If we have a session ID, set it on the current agent
      if (this.currentSessionId) {
        console.log('Using existing session ID:', this.currentSessionId);
        this.currentAgent.setSessionId(this.currentSessionId);
      }

      // Use the current agent to process the message
      const response = await this.currentAgent.sendMessage(userMessage);

      // Store the session ID for future use
      if (response.sessionId) {
        this.currentSessionId = response.sessionId;
        console.log('Updated session ID:', this.currentSessionId);
      }

      // Log the full response for debugging
      console.log('Full response from agent:', response);
      console.log('Raw message content:', response.message);

      // Improved JSON extraction and processing
      let parsedOptions: ChatOption[] | undefined;
      let messageText = response.message;
      let projectData = null;

      // Search for complete JSON objects by finding matching braces
      const potentialJsonObjects = this.findCompleteJsonObjects(response.message);
      console.log('Potential JSON objects found:', potentialJsonObjects.length);

      for (const jsonStr of potentialJsonObjects) {
        try {
          const parsed = JSON.parse(jsonStr);
          console.log('Successfully parsed JSON object:', parsed);

          // Check if this is an options object
          if (parsed.question && Array.isArray(parsed.options)) {
            console.log('Found options JSON');
            parsedOptions = parsed.options;
            messageText = parsed.question;
          }
          // Check if this is a project data object
          else if (parsed.project_name && parsed.object_type) {
            console.log('Found project data JSON');
            projectData = parsed;

            // If we already have options, format the message to include both
            if (parsedOptions) {
              messageText = `${JSON.stringify(projectData, null, 2)}\n\n${messageText}`;
            }
          }
        } catch (e) {
          console.error('Failed to parse JSON object:', e);
        }
      }

      // Add response to chat
      this.messages.push({
        id: this.messages.length,
        text: messageText,
        isSystem: true,
        timestamp: new Date(),
        needMoreInformation: response.needMoreInformation,
        options: parsedOptions,
        projectData: projectData
      });

      // If last input was voice, read response aloud
      if (this.lastInputWasVoice && messageText) {
        this.readResponseAloud(messageText);
        this.lastInputWasVoice = false;
      }

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

// Add a helper function to find complete JSON objects in text
  findCompleteJsonObjects(text: string): string[] {
    const results: string[] = [];
    let braceCount = 0;
    let startIndex = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceCount === 0) {
          startIndex = i;
        }
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          // We found a complete JSON object
          results.push(text.substring(startIndex, i + 1));
          startIndex = -1;
        }
      }
    }

    return results;
  }

  async selectOption(option: ChatOption, message: ChatMessage) {
    console.log('Option selected:', option);
    console.log('Parent message:', message);
    console.log('Current session ID before option selection:', this.currentSessionId);

    // Add user's selection as a message in the chat display
    this.messages.push({
      id: this.messages.length,
      text: `Selected: ${option.label}`,
      isUser: true,
      timestamp: new Date(),
      needMoreInformation: false
    });

    // If "submit" option is selected, handle the transition to SVG agent
    if (option.label.toLowerCase().includes('submit')) {
      this.isLoading = true;

      try {
        console.log('Submitting final request to consultant agent with option ID:', option.id);

        // Ensure the consultant agent has the current session ID
        if (this.currentSessionId) {
          console.log('Using existing session ID for consultant:', this.currentSessionId);
          this.currentAgent.setSessionId(this.currentSessionId);
        }

        // Send the option ID directly to the agent
        const response = await this.currentAgent.sendMessage(`${option.id}`);

        // Update the session ID from the response
        if (response.sessionId) {
          this.currentSessionId = response.sessionId;
          console.log('Updated session ID after final consultant response:', this.currentSessionId);
        }

        console.log('Full consultant final response:', response);
        console.log('Consultant response raw message:', response.message);

        // Extract project data from the response
        let projectData = null;
        try {
          console.log('Looking for JSON project data in response...');
          const jsonMatches = this.findCompleteJsonObjects(response.message);
          console.log('JSON matches found:', jsonMatches);

          if (jsonMatches) {
            for (const match of jsonMatches) {
              try {
                console.log('Attempting to parse JSON match:', match);
                const parsed = JSON.parse(match);
                console.log('Successfully parsed JSON:', parsed);

                if (parsed.project_name && parsed.object_type && parsed.primary_function) {
                  projectData = parsed;
                  console.log('Found project data:', projectData);
                  break;
                }
              } catch (parseError) {
                console.error('Failed to parse JSON match:', parseError);
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing project data:', parseError);
        }

        // Add final consultant response to chat
        this.messages.push({
          id: this.messages.length,
          text: response.message,
          isSystem: true,
          timestamp: new Date(),
          needMoreInformation: false
        });

        // Now switch to SVG agent
        console.log('Switching from consultant to SVG agent');
        this.activeAgentType = 'svg';
        this.currentAgent = this.svgAgentService;
        this.svgAgent = true;
        this.threeDAgent = false;
        this.showPreview = true;

        // Create a new session for the SVG agent
        const newSvgSessionId = 'svg-session-' + Date.now();
        console.log('Creating new SVG agent session:', newSvgSessionId);
        this.svgAgentService.setSessionId(newSvgSessionId);
        this.currentSessionId = newSvgSessionId;

        // Add a transition message
        this.messages.push({
          id: this.messages.length,
          text: "Switching to SVG generation mode. Creating graphics based on your specifications...",
          isSystem: true,
          timestamp: new Date(),
          needMoreInformation: false
        });

        // If project data was extracted, send it to SVG agent
        if (projectData) {
          console.log("Extracted project data to send to SVG agent:", projectData);

          // Format the project data for the SVG agent
          const projectDataString = JSON.stringify(projectData, null, 2);
          const svgPrompt = `Please create SVG designs based on the following project specifications:\n\`\`\`json\n${projectDataString}\n\`\`\``;

          console.log('SVG agent prompt:', svgPrompt);

          // Send the extracted data to the SVG agent
          console.log('Sending prompt to SVG agent...');
          const svgResponse = await this.svgAgentService.sendMessage(svgPrompt);
          console.log('Full SVG agent response:', svgResponse);
          console.log('SVG agent raw message:', svgResponse.message);
          console.log('SVG agent session ID:', svgResponse.sessionId);

          // Update the session ID if it changed
          if (svgResponse.sessionId) {
            this.currentSessionId = svgResponse.sessionId;
            console.log('Updated session ID after SVG response:', this.currentSessionId);
          }

          // Extract SVG code from the response
          console.log('Extracting SVG codes from response...');
          this.extractSvgCodesFromResponse(svgResponse.message);
          console.log('Extracted SVG codes:', this.generatedSvgCodes);

          // Add SVG agent's response to chat
          this.messages.push({
            id: this.messages.length,
            text: svgResponse.message,
            isSystem: true,
            timestamp: new Date(),
            needMoreInformation: false
          });

          // If no SVGs found, show error message
          if (this.generatedSvgCodes.length === 0) {
            console.log('No SVG designs found in the response');
            this.messages.push({
              id: this.messages.length,
              text: 'No SVG designs were found in the response. Please try again with different specifications.',
              isSystem: true,
              timestamp: new Date(),
              needMoreInformation: false
            });
          }
        } else {
          console.log('Failed to extract project data from consultant response');
          this.messages.push({
            id: this.messages.length,
            text: "I couldn't extract project specifications from the consultant's response. Please describe what you'd like me to create.",
            isSystem: true,
            timestamp: new Date(),
            needMoreInformation: true
          });
        }

      } catch (error) {
        console.error('Error in submit workflow:', error);
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
    } else {
      // For non-submit options, send directly to current agent
      this.isLoading = true;

      try {
        console.log('Sending option ID to current agent:', option.id);

        // Ensure the current agent has the correct session ID
        if (this.currentSessionId) {
          console.log('Using existing session ID for option selection:', this.currentSessionId);
          this.currentAgent.setSessionId(this.currentSessionId);
        }

        // Send the option ID directly to the agent
        const response = await this.currentAgent.sendMessage(`${option.id}`);

        // Log full response for debugging
        console.log('Full response from agent after selecting option:', response);
        console.log('Raw message after option selection:', response.message);
        console.log('Session ID after option selection:', response.sessionId);

        // Update the session ID from the response
        if (response.sessionId) {
          this.currentSessionId = response.sessionId;
          console.log('Updated session ID after option selection:', this.currentSessionId);
        }

        // Process the response using the same helper function
        let parsedOptions: ChatOption[] | undefined;
        let messageText = response.message;
        let projectData = null;

        // Search for complete JSON objects by finding matching braces
        const potentialJsonObjects = this.findCompleteJsonObjects(response.message);
        console.log('Potential JSON objects found:', potentialJsonObjects.length);

        for (const jsonStr of potentialJsonObjects) {
          try {
            const parsed = JSON.parse(jsonStr);
            console.log('Successfully parsed JSON object:', parsed);

            // Check if this is an options object
            if (parsed.question && Array.isArray(parsed.options)) {
              console.log('Found options JSON');
              parsedOptions = parsed.options;
              messageText = parsed.question;
            }
            // Check if this is a project data object
            else if (parsed.project_name && parsed.object_type) {
              console.log('Found project data JSON');
              projectData = parsed;

              // If we already have options, format the message to include both
              if (parsedOptions) {
                messageText = `${JSON.stringify(projectData, null, 2)}\n\n${messageText}`;
              }
            }
          } catch (e) {
            console.error('Failed to parse JSON object:', e);
          }
        }

        // Add response to chat
        this.messages.push({
          id: this.messages.length,
          text: messageText,
          isSystem: true,
          timestamp: new Date(),
          needMoreInformation: response.needMoreInformation,
          options: parsedOptions,
          projectData: projectData
        });

      } catch (error) {
        console.error('Error sending option to agent:', error);
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
  // In chat.component.ts, add this method:
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

// Add the method to handle conversion of components
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

    // Pass the model URL to the 3D viewer component
    this.modelUrl = url;

    // Save the STL file
    this.saveStlFile(response);

    // Add a message to the chat indicating the model is ready
    this.messages.push({
      id: this.messages.length,
      text: 'Your 3D model has been created and is ready for preview. You can now view it in the 3D viewer. The STL file has also been saved to your downloads.',
      isSystem: true,
      timestamp: new Date(),
      needMoreInformation: false
    });
  }

  // Add this new method to save the STL file
  private saveStlFile(blob: Blob): void {
    // Create a date-time string for filename uniqueness
    const date = new Date();
    const dateString = date.toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // Create a download link
    const downloadLink = document.createElement('a');
    downloadLink.href = window.URL.createObjectURL(blob);
    downloadLink.download = `3d-model-${dateString}.stl`;

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
