import { TestBed } from '@angular/core/testing';

import { AnthropicServiceService } from './anthropic-service.service';

describe('AnthropicServiceService', () => {
  let service: AnthropicServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnthropicServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
