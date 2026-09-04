import { Email } from './email';
import { InvalidUserDataError } from './errors/user-domain.error';
import { normalizeName, User, validatePassword } from './user';

function createUser(name = 'Maria Silva'): User {
  return User.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    email: Email.create('maria@example.com'),
    id: 'user-123',
    name,
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash',
  });
}

describe('user invariants', () => {
  it('trims only the outer spaces from the name', () => {
    expect(normalizeName('  Maria  Silva  ')).toBe('Maria  Silva');
  });

  it.each(['A', 'A'.repeat(101)])(
    'rejects a name outside the inclusive 2 to 100 range',
    (name) => {
      expect(() => normalizeName(name)).toThrow(InvalidUserDataError);
    },
  );

  it('accepts name boundaries after normalization', () => {
    expect(normalizeName(` ${'A'.repeat(2)} `)).toHaveLength(2);
    expect(normalizeName(` ${'A'.repeat(100)} `)).toHaveLength(100);
  });

  it.each(['1234567', '1'.repeat(129)])(
    'rejects a password outside the inclusive 8 to 128 range',
    (password) => {
      expect(() => validatePassword(password)).toThrow(InvalidUserDataError);
    },
  );

  it('accepts password boundaries without transforming the input', () => {
    expect(() => validatePassword('1'.repeat(8))).not.toThrow();
    expect(() => validatePassword('1'.repeat(128))).not.toThrow();
  });

  it('keeps the plain password out of the entity and serializes only public data', () => {
    const plainPassword = 'senha-super-secreta';
    const user = createUser();
    const serialized = JSON.stringify(user);

    expect(serialized).toEqual(
      JSON.stringify({
        email: 'maria@example.com',
        id: 'user-123',
        name: 'Maria Silva',
      }),
    );
    expect(serialized).not.toContain(plainPassword);
    expect(serialized).not.toContain(user.passwordHash);
  });
});
