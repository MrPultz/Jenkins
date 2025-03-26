import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreeWithUploadComponent } from './three-with-upload.component';

describe('ThreeWithUploadComponent', () => {
  let component: ThreeWithUploadComponent;
  let fixture: ComponentFixture<ThreeWithUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreeWithUploadComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ThreeWithUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
