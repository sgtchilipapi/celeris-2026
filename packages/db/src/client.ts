import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __celerisPrismaClient__: PrismaClient | undefined;
}

export function getPrismaClient() {
  if (!globalThis.__celerisPrismaClient__) {
    globalThis.__celerisPrismaClient__ = new PrismaClient();
  }

  return globalThis.__celerisPrismaClient__;
}

export async function closePrismaClient() {
  if (globalThis.__celerisPrismaClient__) {
    await globalThis.__celerisPrismaClient__.$disconnect();
    globalThis.__celerisPrismaClient__ = undefined;
  }
}
