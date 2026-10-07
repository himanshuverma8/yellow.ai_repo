import { ERROR_CATALOG, type ErrorCode, type ErrorType } from "./error-catalog.js";

interface AppErrorOptions {
  description?: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly type: ErrorType;
  readonly statusCode: number;
  readonly description: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const definition = ERROR_CATALOG[code];
    const description = options.description ?? definition.description;
    super(description);
    this.name = "AppError";
    this.code = code;
    this.type = definition.type;
    this.statusCode = definition.status;
    this.description = description;
    this.details = options.details;
  }

  toJSON() {
    return {
      code: this.code,
      type: this.type,
      description: this.description,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}
