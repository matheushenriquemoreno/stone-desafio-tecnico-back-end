import { SystemClock } from './system-clock';

describe('SystemClock', () => {
  it('returns a current Date instance', () => {
    const before = Date.now();
    const instant = new SystemClock().now().getTime();
    const after = Date.now();

    expect(instant).toBeGreaterThanOrEqual(before);
    expect(instant).toBeLessThanOrEqual(after);
  });
});
