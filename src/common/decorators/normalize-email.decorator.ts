// src/common/decorators/normalize-email.decorator.ts
import { Transform } from 'class-transformer';

export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value.trim().toLowerCase();
  });
}
