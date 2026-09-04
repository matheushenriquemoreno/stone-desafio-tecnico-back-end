import argon2 from 'argon2';

import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();
  const plainPassword = 'senha-super-secreta';

  it('creates a salted Argon2id hash without returning the password', async () => {
    const passwordHash = await hasher.hash(plainPassword);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).toMatch(/\$m=19456,t=2,p=1\$/);
    expect(passwordHash).not.toBe(plainPassword);
    expect(passwordHash).not.toContain(plainPassword);
    expect(await argon2.verify(passwordHash, plainPassword)).toBe(true);
  });

  it('verifies the correct password and rejects an incorrect one', async () => {
    const passwordHash = await hasher.hash(plainPassword);

    await expect(hasher.verify(passwordHash, plainPassword)).resolves.toBe(true);
    await expect(hasher.verify(passwordHash, 'senha-incorreta')).resolves.toBe(false);
  });

  it('treats a malformed stored hash as an invalid credential', async () => {
    await expect(hasher.verify('not-a-password-hash', plainPassword)).resolves.toBe(
      false,
    );
  });
});
