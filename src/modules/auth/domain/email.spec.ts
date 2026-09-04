import { Email } from './email';
import { InvalidUserDataError } from './errors/user-domain.error';

describe('Email', () => {
  it('trims outer spaces and lowercases the address before storing it', () => {
    const email = Email.create('  Maria.Silva@Example.COM  ');

    expect(email.value).toBe('maria.silva@example.com');
    expect(email.toString()).toBe('maria.silva@example.com');
  });

  it.each([
    '',
    'maria.example.com',
    '@example.com',
    'maria@',
    'maria @example.com',
    'maria@example',
  ])('rejects invalid address %j with a domain error', (input) => {
    expect(() => Email.create(input)).toThrow(InvalidUserDataError);
    expect(() => Email.create(input)).toThrow(
      'O e-mail informado possui formato inválido.',
    );
  });
});
