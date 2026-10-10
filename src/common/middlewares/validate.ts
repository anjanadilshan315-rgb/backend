import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

export interface ValidationIssue {
  location: keyof RequestSchemas;
  field: string;
  message: string;
}

/**
 * Validates and coerces params / query / body with zod. On success the parsed
 * values replace the raw ones, so handlers always receive clean, typed input.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const issues: ValidationIssue[] = [];

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location] ?? {});
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({ location, field: issue.path.join('.'), message: issue.message });
        }
        continue;
      }

      if (location === 'query') {
        // req.query is a getter in Express 5, so it has to be redefined.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[location] = result.data as never;
      }
    }

    if (issues.length > 0) throw AppError.validation(issues);
    next();
  };
}
