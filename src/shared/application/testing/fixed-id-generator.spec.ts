import { FixedIdGenerator } from './fixed-id-generator';

describe('FixedIdGenerator', () => {
  it('returns identifiers in the configured deterministic order', () => {
    const generator = new FixedIdGenerator(['user-1', 'product-1']);

    expect(generator.generate()).toBe('user-1');
    expect(generator.generate()).toBe('product-1');
  });

  it('fails explicitly when the deterministic sequence is exhausted', () => {
    const generator = new FixedIdGenerator(['only-id']);
    generator.generate();

    expect(() => generator.generate()).toThrow('não possui mais IDs');
  });
});
