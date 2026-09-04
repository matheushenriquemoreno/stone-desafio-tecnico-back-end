import { Injectable } from '@nestjs/common';

import type {
  RequestLogEntry,
  RequestLogger,
} from '../../application/ports/request-logger';

@Injectable()
export class ConsoleRequestLogger implements RequestLogger {
  log(entry: RequestLogEntry): void {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}
