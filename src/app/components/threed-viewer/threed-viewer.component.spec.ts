import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreedViewerComponent } from './threed-viewer.component';

describe('TreedViewerComponent', () => {
  let component: TreedViewerComponent;
  let fixture: ComponentFixture<TreedViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreedViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreedViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
