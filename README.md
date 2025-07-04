# Installation Guide

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Angular CLI](https://angular.io/cli)
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/MrPultz/Jenkins.git
cd Jenkins
```
### 2. Install Dependencies
```bash
npm install
```

### 3 Development server
start the development server:
```bash
ng serve
```

### Claude API key setup.
Create a claude.ts file in src/environments/claude.ts and add your
Claude API key:
```typescript
export const claude = {
  production: false,
  apiKey: 'key here...',
  apiUrl: 'https://api.anthropic.com/v1/messages',
};
```
### Update Claude version
to update claude from 3.7 or what version come look up the verison on their documentation and change it in src/services/anthropic-chat-agent.service.ts
```typescript
 const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219', <-- CHANGE THIS TO LATEST VERSION
        max_tokens: 4000,
        temperature: 0,
        system: this.systemPromptContent,
        messages: this.messages
      });
```

