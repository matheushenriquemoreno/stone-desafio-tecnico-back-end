import { randomUUID } from 'node:crypto';

import type { IdGenerator } from '../../application/ports/id-generator';

export class SecureIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
