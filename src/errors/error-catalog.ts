export type ErrorType = "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "BUSINESS_RULE" | "INTERNAL";

export const ERROR_CATALOG = {
  // validation
  VALIDATION_ERROR: { status: 400, type: "VALIDATION", description: "Request validation failed" },
  MALFORMED_JSON: { status: 400, type: "VALIDATION", description: "Request body is not valid JSON" },
  IDEMPOTENCY_KEY_REQUIRED: {
    status: 400,
    type: "VALIDATION",
    description: "A non-empty Idempotency-Key header is required",
  },

  // coupons
  COUPON_NOT_FOUND: { status: 404, type: "NOT_FOUND", description: "Coupon code does not exist" },
  COUPON_ALREADY_EXISTS: { status: 409, type: "CONFLICT", description: "A coupon with this code already exists" },
  COUPON_EXPIRED: { status: 422, type: "BUSINESS_RULE", description: "Coupon has expired" },
  COUPON_ALREADY_USED: {
    status: 409,
    type: "CONFLICT",
    description: "This customer has already redeemed this coupon",
  },
  COUPON_EXHAUSTED: { status: 409, type: "CONFLICT", description: "No redemptions left for this coupon" },

  // orders
  ORDER_NOT_FOUND: { status: 404, type: "NOT_FOUND", description: "Order does not exist" },
  ORDER_CANCELLED: { status: 422, type: "BUSINESS_RULE", description: "Order has been cancelled" },
  ORDER_CUSTOMER_MISMATCH: {
    status: 422,
    type: "BUSINESS_RULE",
    description: "Order belongs to a different customer",
  },
  ORDER_ALREADY_HAS_COUPON: {
    status: 409,
    type: "CONFLICT",
    description: "A coupon has already been redeemed for this order",
  },

  // idempotency
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    type: "BUSINESS_RULE",
    description: "Idempotency-Key was already used with a different request payload",
  },

  // generic
  ROUTE_NOT_FOUND: { status: 404, type: "NOT_FOUND", description: "Route not found" },
  INTERNAL_ERROR: { status: 500, type: "INTERNAL", description: "Something went wrong" },
} as const satisfies Record<string, { status: number; type: ErrorType; description: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;
