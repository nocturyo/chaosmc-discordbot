import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log("✅ Połączono z bazą MySQL!");
  } catch (err) {
    console.error("❌ Błąd połączenia z bazą:", err);
  }
}
