import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { hasAtMostTwoDecimalPlaces } from '../domain/product';

@ValidatorConstraint({ name: 'maxTwoDecimalPlaces', async: false })
export class MaxTwoDecimalPlacesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return true;
    }

    return hasAtMostTwoDecimalPlaces(value);
  }

  defaultMessage(): string {
    return 'O preço deve ter até duas casas decimais.';
  }
}

export function MaxTwoDecimalPlaces(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      constraints: [],
      options: validationOptions,
      propertyName: propertyKey.toString(),
      target: target.constructor,
      validator: MaxTwoDecimalPlacesConstraint,
    });
  };
}
