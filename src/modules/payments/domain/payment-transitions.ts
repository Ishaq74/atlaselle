import { randomUUID } from "node:crypto";
import type { PaymentStatus } from "@database/schemas/payments.schema";

// TODO §13 — module générique, idempotent (clé d'idempotence unique).
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  created: ["pending", "cancelled"],
  pending: ["authorized", "paid", "failed", "cancelled"],
  authorized: ["paid", "failed", "cancelled"],
  paid: ["refunded", "partially_refunded"],
  failed: ["pending"],
  cancelled: [],
  refunded: [],
  partially_refunded: ["refunded"],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionPayment(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition: ${from} → ${to}`);
  }
}

export function newIdempotencyKey(): string {
  return randomUUID();
}
