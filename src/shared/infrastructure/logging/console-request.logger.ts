import { Injectable } from '@nestjs/common';

import type {
  RateLimitFallbackLogEntry,
  RequestLogEntry,
  RequestLogger,
} from '../../application/ports/request-logger';

@Injectable()
export class ConsoleRequestLogger implements RequestLogger {
  log(entry: RequestLogEntry): void {
    this.write(entry);
  }

  warn(entry: RateLimitFallbackLogEntry): void {
    this.write(entry);
  }

  private write(entry: RequestLogEntry | RateLimitFallbackLogEntry): void {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}
