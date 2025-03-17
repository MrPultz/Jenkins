import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScadEditorComponent } from './scad-editor.component';

describe('ScadEditorComponent', () => {
  let component: ScadEditorComponent;
  let fixture: ComponentFixture<ScadEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScadEditorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ScadEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
