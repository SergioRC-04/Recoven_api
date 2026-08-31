// src/common/decorators/trim.decorator.ts
import { Transform } from 'class-transformer';

export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    return typeof value === 'string' ? value.trim() : value;
  });
}
