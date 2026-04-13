import { Prisma } from "@prisma/client";

export const toDecimal = (amount: number | string) =>
  new Prisma.Decimal(amount);

export const isPositive = (amount: Prisma.Decimal) =>
  amount.gt(0);
