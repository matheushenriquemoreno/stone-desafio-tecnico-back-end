import { Injectable, type OnModuleInit } from '@nestjs/common';

import type { ApplicationLifecycle } from '../application/ports/application-lifecycle';

@Injectable()
export class NestApplicationLifecycle implements ApplicationLifecycle, OnModuleInit {
  private initialized = false;

  onModuleInit(): void {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
