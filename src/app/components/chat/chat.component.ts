import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
  SimpleChanges,
  OnInit
} from '@angular/core';
import {MarkdownComponent} from "ngx-markdown";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SvgviewerComponent} from "../svgviewer/svgviewer.component";
import {ThreedViewerComponent} from "../threed-viewer/threed-viewer.component";
import {ThreeWithUploadComponent} from "../three-with-upload/three-with-upload.component";

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    MarkdownComponent,
    NgForOf,
    NgIf,
    ReactiveFormsModule,
    NgClass,
    FormsModule
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnChanges, OnInit {
  @Input() messages: any[] = [];
  @Input() isLoading = false;
  @Input() isSpeaking = false;
  @Input() isRecording = false;
  @Input() useAnthropicModel = false;

  @Output() sendMessageEvent = new EventEmitter<string>();
  @Output() optionSelectedEvent = new EventEmitter<{option: any, message: any}>();
  @Output() speakTextEvent = new EventEmitter<string>();
  @Output() toggleRecordingEvent = new EventEmitter<void>();
  @Output() modelChangeEvent = new EventEmitter<boolean>();

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  private shouldAutoScroll = true;
  private userScrolled = false;
  useLongText = false;

  inputMessage = '';

  ngOnInit() {
    // Add welcome message as the first system message
    //NOTE: It needs to be indented like this or else it will render badly.
    this.messages.push({
      text: `## Welcome to Jenkins!

I can help you design and create 3D models. Right now I'm limited to Keyboard and Remote controls. And the customization is not able to generate any object you want as of yet.

Here are some suggestions for what to generate, but feel free to explore:
- A keyboard with 8 buttons
- A Samsung Remote control for your TV
- The numpad of a keyboard
- The arrow keys on a keyboard

What would you like to create today?`,
      isSystem: true,
      isUser: false
    });
  }

  ngAfterViewInit() {
    // Add scroll event listener to detect manual scrolling
    if (this.chatContainer?.nativeElement) {
      this.chatContainer.nativeElement.addEventListener('scroll', () => {
        const element = this.chatContainer.nativeElement;
        const atBottom = Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 50;

        // Update shouldAutoScroll based on whether the user is at the bottom
        this.shouldAutoScroll = atBottom;

        // Set userScrolled to true only when not at the bottom
        this.userScrolled = !atBottom;
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Check if messages array has changed
    if (changes['messages'] && !changes['messages'].firstChange) {
      // If messages were added (length increased)
      const previousLength = changes['messages'].previousValue?.length || 0;
      const currentLength = changes['messages'].currentValue?.length || 0;

      if (currentLength > previousLength) {
        // New message was added
        this.onNewMessage();
      }
    }
  }

  sendMessage(): void {
    if (this.inputMessage.trim()) {
      this.sendMessageEvent.emit(this.inputMessage);
      this.inputMessage = '';
    }
  }

  selectOption(option: any, message: any): void {
    this.optionSelectedEvent.emit({ option, message });
  }

  readResponseAloud(text: string): void {
    this.speakTextEvent.emit(text);
  }

  toggleVoiceRecognition(): void {
    this.toggleRecordingEvent.emit();
  }

  onModelChange(event: any) {
    // Emit the new model selection (true for Claude, false for DeepSeek)
    this.modelChangeEvent.emit(event.target.value === 'claude');
  }

  onTextAmountChange(event: any) {
    this.useLongText = event.target.checked;

    // If toggling to short text mode, update any existing system messages
    if (!this.useLongText) {
      this.messages.forEach(message => {
        if (message.isSystem && message.originalText) {
          // Store the current long text as original if not already stored
          message.originalText = message.originalText || message.text;
          // Replace with shorter summary
          message.text = "I have started generating your 3D model. Please wait. If you want to have full information about the model, please toggle 'Use long text' in the chat.";
        }
      });
    } else {
      // If toggling to long text mode, restore original messages
      this.messages.forEach(message => {
        if (message.isSystem && message.originalText) {
          message.text = message.originalText;
        }
      });
    }
  }

  // Call this method whenever a new message is added
  scrollToBottom(): void {
    // Only auto-scroll if user hasn't manually scrolled up
    if (this.shouldAutoScroll) {
      try {
        setTimeout(() => {
          if (this.chatContainer?.nativeElement) {
            const element = this.chatContainer.nativeElement;
            element.scrollTop = element.scrollHeight;
          }
        }, 100);
      } catch (err) {
        console.error('Error scrolling to bottom:', err);
      }
    }
  }

// Call this when AI responds or user sends a new message
  onNewMessage() {
    this.scrollToBottom();
  }

// Reset userScrolled flag when user explicitly wants to jump to bottom
  jumpToLatestMessages() {
    this.shouldAutoScroll = true;
    this.userScrolled = false;
    this.scrollToBottom();
  }


}
