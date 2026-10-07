import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import type { ErrorCode } from "../errors/error-catalog.js";

// A validation failure on one of these fields maps to a dedicated error code
const FIELD_ERROR_CODES: Record<string, ErrorCode> = {
  "idempotency-key": "IDEMPOTENCY_KEY_REQUIRED",
};

function fromZodError(err: ZodError): AppError {
  const details = err.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
  const field = String(err.issues[0]?.path[0] ?? "");
  return new AppError(FIELD_ERROR_CODES[field] ?? "VALIDATION_ERROR", { details });
}

function isBodyParseError(err: unknown): boolean {
  return err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed";
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return fromZodError(err);
  if (isBodyParseError(err)) return new AppError("MALFORMED_JSON");
  return new AppError("INTERNAL_ERROR");
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("ROUTE_NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const appError = toAppError(err);
  if (appError.statusCode >= 500) console.error(err);
  res.status(appError.statusCode).json({ error: appError.toJSON() });
};
