import type { Clock } from '../ports/clock';

export class FixedClock implements Clock {
  private readonly instantMilliseconds: number;

  constructor(instant: Date) {
    const instantMilliseconds = instant.getTime();

    if (Number.isNaN(instantMilliseconds)) {
      throw new Error('O relógio de teste exige um instante válido.');
    }

    this.instantMilliseconds = instantMilliseconds;
  }

  now(): Date {
    return new Date(this.instantMilliseconds);
  }
}
