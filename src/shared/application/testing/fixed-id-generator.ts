import type { IdGenerator } from '../ports/id-generator';

export class FixedIdGenerator implements IdGenerator {
  private nextIndex = 0;

  constructor(private readonly identifiers: readonly string[]) {}

  generate(): string {
    const identifier = this.identifiers[this.nextIndex];

    if (identifier === undefined) {
      throw new Error('O gerador de IDs de teste não possui mais IDs disponíveis.');
    }

    this.nextIndex += 1;
    return identifier;
  }
}
