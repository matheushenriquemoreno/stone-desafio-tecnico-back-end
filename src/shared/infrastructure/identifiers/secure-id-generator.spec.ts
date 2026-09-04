import { SecureIdGenerator } from './secure-id-generator';

describe('SecureIdGenerator', () => {
  it('generates opaque UUID identifiers', () => {
    const generator = new SecureIdGenerator();

    expect(generator.generate()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
