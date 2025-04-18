import {Component, ElementRef, EventEmitter, OnInit, Output, ViewChild} from '@angular/core';
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-drawing',
  standalone: true,
  imports: [
    FormsModule
  ],
  templateUrl: './drawing.component.html',
  styleUrl: './drawing.component.css'
})
export class DrawingComponent implements OnInit {
  @Output() drawingSubmitted = new EventEmitter<string>();

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private cursor: HTMLElement | null = null;

  // Drawing settings
  strokeColor = '#000000';
  lineWidth = 3;


  // Undo/Redo functionality
  protected drawActions: ImageData[] = [];
  protected currentActionIndex = -1;
  private maxActions = 50;

  // Eraser functionality
  isEraser = false;

  ngOnInit() {
    const canvas = this.canvas.nativeElement;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Could not get 2D context from canvas');
      return;
    }

    this.ctx = context;
    this.resizeCanvas();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    this.setupCursorTracking();

    // save initial blank canvas state
    this.saveCurrentState();
  }

  private saveCurrentState() {
    // Don't save if we haven't initialized the canvas yet
    if (!this.ctx) return;

    const canvas = this.canvas.nativeElement;
    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    // If we're not at the end of the actions array, remove future actions
    if (this.currentActionIndex < this.drawActions.length - 1) {
      this.drawActions = this.drawActions.slice(0, this.currentActionIndex + 1);
    }

    // Add new state to history
    this.drawActions.push(imageData);
    this.currentActionIndex++;

    // Limit history size
    if (this.drawActions.length > this.maxActions) {
      this.drawActions.shift();
      this.currentActionIndex--;
    }
  }

  undo() {
    if (this.currentActionIndex > 0) {
      this.currentActionIndex--;
      this.restoreState();
    }
  }

  redo() {
    if (this.currentActionIndex < this.drawActions.length - 1) {
      this.currentActionIndex++;
      this.restoreState();
    }
  }


  private restoreState() {
    const canvas = this.canvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.putImageData(this.drawActions[this.currentActionIndex], 0, 0);
  }

  toggleEraser() {
    this.isEraser = !this.isEraser;
  }

  private setupCursorTracking() {
    const canvas = this.canvas.nativeElement;

    // Create a custom cursor element
    this.cursor = document.createElement('div');
    this.cursor.className = 'custom-cursor';
    this.cursor.style.position = 'absolute';
    this.cursor.style.width = '6px';
    this.cursor.style.height = '6px';
    this.cursor.style.backgroundColor = '#ffffff';
    this.cursor.style.borderRadius = '50%';
    this.cursor.style.transform = 'translate(-50%, -50%)';
    this.cursor.style.pointerEvents = 'none';
    this.cursor.style.zIndex = '1000';

    // Add the cursor to the canvas container
    const container = canvas.parentElement;
    if (container) {
      container.style.position = 'relative';  // Ensure container is positioned
      container.appendChild(this.cursor);
    }

    // Track mouse movement
    canvas.addEventListener('mousemove', (e) => {
      if (this.cursor) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.cursor.style.left = `${x}px`;
        this.cursor.style.top = `${y}px`;
        this.cursor.style.backgroundColor = '#ffffff';
        this.cursor.style.width = `${this.lineWidth}px`;
        this.cursor.style.height = `${this.lineWidth}px`;
      }
    });

    canvas.addEventListener('mouseenter', () => {
      if (this.cursor) this.cursor.style.display = 'block';
    });

    canvas.addEventListener('mouseleave', () => {
      if (this.cursor) this.cursor.style.display = 'none';
    });
  }
  private resizeCanvas() {
    const canvas = this.canvas.nativeElement;
    const container = canvas.parentElement;

    if (!container) return;

    // Save current drawing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0);
    }

    // Get the available height (container height minus controls height)
    const controlsElement = container.querySelector('.drawing-controls');
    const controlsHeight = controlsElement ? controlsElement.clientHeight : 80;

    // Resize canvas - account for the controls height
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight - controlsHeight;

    // Update canvas style to ensure it doesn't overflow
    canvas.style.height = `${canvas.height}px`;

    // Restore drawing
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Could not get 2D context from canvas');
      return;
    }

    // Restore drawing
    this.ctx = context;
    this.ctx.drawImage(tempCanvas, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  startDrawing(event: MouseEvent) {
    this.isDrawing = true;

    // Get exact center coordinates
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    this.lastX = event.clientX - rect.left;
    this.lastY = event.clientY - rect.top;
  }

  draw(event: MouseEvent) {
    if (!this.isDrawing) return;

    // Get exact center coordinates
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(currentX, currentY);

    if (this.isEraser) {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(255,255,255,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.strokeColor;
    }

    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.stroke();

    // Use the same coordinate calculation method as above
    this.lastX = currentX;
    this.lastY = currentY;
  }

  startTouchDrawing(event: TouchEvent) {
    event.preventDefault();
    if(event.touches.length === 1){
      const touch = event.touches[0];
      const rect = this.canvas.nativeElement.getBoundingClientRect();
      this.lastX = touch.clientX - rect.left;
      this.lastY = touch.clientY - rect.top;
      this.isDrawing = true;
    }
  }

  touchDraw(event: TouchEvent) {
    event.preventDefault();
    if(!this.isDrawing) return;

    const touch = event.touches[0];
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(currentX, currentY);

    if (this.isEraser) {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(255,255,255,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.strokeColor;
    }

    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.stroke();

    this.lastX = currentX;
    this.lastY = currentY;
  }

  // Save state when stopping drawing
  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.ctx.closePath();
      this.saveCurrentState();
    }
  }

  clearCanvas() {
    const canvas = this.canvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.saveCurrentState();
  }

  submitDrawing() {
    // Convert canvas to data URL (PNG format by default)
    const canvas = this.canvas.nativeElement;
    const imageData = canvas.toDataURL('image/png');

    // Emit the image data to parent component
    this.drawingSubmitted.emit(imageData);

    // Optional: clear canvas after submission
    this.clearCanvas();
  }

}
