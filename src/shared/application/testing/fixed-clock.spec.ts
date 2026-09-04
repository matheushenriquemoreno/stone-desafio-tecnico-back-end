import { FixedClock } from './fixed-clock';

describe('FixedClock', () => {
  it('returns the configured instant without sharing a mutable Date instance', () => {
    const configuredInstant = new Date('2026-09-04T12:00:00.000Z');
    const clock = new FixedClock(configuredInstant);

    const returnedInstant = clock.now();
    returnedInstant.setUTCFullYear(2030);

    expect(clock.now()).toEqual(configuredInstant);
  });

  it('rejects an invalid configured instant', () => {
    expect(() => new FixedClock(new Date('not-a-date'))).toThrow('instante válido');
  });
});
