import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SvgviewerComponent } from './svgviewer.component';

describe('SvgviewerComponent', () => {
  let component: SvgviewerComponent;
  let fixture: ComponentFixture<SvgviewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SvgviewerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SvgviewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
