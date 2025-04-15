import { Component, EventEmitter, Input, Output } from '@angular/core';
import {MarkdownComponent} from "ngx-markdown";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SvgviewerComponent} from "../svgviewer/svgviewer.component";
import {ThreedViewerComponent} from "../threed-viewer/threed-viewer.component";

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    MarkdownComponent,
    NgForOf,
    NgIf,
    ReactiveFormsModule,
    SvgviewerComponent,
    ThreedViewerComponent,
    NgClass,
    FormsModule
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent {
  @Input() messages: any[] = [];
  @Input() isLoading = false;
  @Input() isSpeaking = false;
  @Input() isRecording = false;

  @Output() sendMessageEvent = new EventEmitter<string>();
  @Output() optionSelectedEvent = new EventEmitter<{option: any, message: any}>();
  @Output() speakTextEvent = new EventEmitter<string>();
  @Output() toggleRecordingEvent = new EventEmitter<void>();

  inputMessage = '';

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


}
