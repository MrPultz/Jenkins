import { Component } from '@angular/core';
import {ChatComponent} from "../../components/chat/chat.component";
import {NgIf} from "@angular/common";
import {ThreeWithUploadComponent} from "../../components/three-with-upload/three-with-upload.component";

@Component({
  selector: 'app-editor',
  standalone: true,
    imports: [
        ChatComponent,
        NgIf,
        ThreeWithUploadComponent,
    ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.css'
})
export class EditorComponent {
  isLoading = false;

}
