import { Routes } from '@angular/router';
import { HomeComponent } from './page/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './guards/auth.guard';
import {ChatPageComponent} from "./page/chat/chatPage.component";
import {ScadEditorComponent} from "./page/scad-editor/scad-editor.component";
import {ThreeWithUploadComponent} from "./components/three-with-upload/three-with-upload.component";
import {MainComponent} from "./page/main/main.component";
import {EditorComponent} from "./page/editor/editor.component";
import {OptionsComponent} from "./page/options/options.component";

export const routes: Routes = [
  { path: '', component: MainComponent, canActivate: [AuthGuard]},
  { path: 'login', component: LoginComponent },
  { path: 'chatPage', component: ChatPageComponent, canActivate: [AuthGuard]},
  { path: 'scadeditor', component: ScadEditorComponent, canActivate: [AuthGuard]},
  { path: 'threeupload', component: ThreeWithUploadComponent, canActivate : [AuthGuard]},
  { path: 'editor', component: EditorComponent, canActivate : [AuthGuard]},
  { path: 'options', component: OptionsComponent, canActivate : [AuthGuard]},
  // Apply AuthGuard to all protected routes
  { path: '**', redirectTo: '' }

];
