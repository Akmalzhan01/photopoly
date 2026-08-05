/**
 * Seeds the plans and, if asked, the first superadmin.
 *
 * Safe to run repeatedly: plans are upserted by their stable `code`, and the
 * superadmin is only created when SEED_ADMIN_EMAIL is set and that address does
 * not already exist — so a rerun can never reset a real user's password.
 *
 *   node --env-file=.env prisma/seed.ts
 *   SEED_ADMIN_EMAIL=me@example.com SEED_ADMIN_PASSWORD=... node --env-file=.env prisma/seed.ts
 */

import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { poolConfig } from "../src/lib/server/pg-ssl.ts";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// Kept in step with src/lib/server/password.ts by hand; the format string below
// is the contract between them.
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

const PLANS = [
  {
    code: "boshlangich",
    name: "Начальный",
    description: "Для тех, кому фото на документы нужны время от времени.",
    priceSom: 199,
    days: 30,
    exportLimit: 50,
    features: [
      "50 экспортов за 30 дней",
      "Все размеры и пресеты",
      "Удаление фона и ручная правка",
      "Раскладка на лист для печати",
    ],
    sortOrder: 1,
  },
  {
    code: "standart",
    name: "Стандарт",
    description: "Для фотографов, которые работают каждый день. Выбирают чаще всего.",
    priceSom: 499,
    days: 30,
    exportLimit: null,
    features: [
      "Безлимитный экспорт 30 дней",
      "Костюмы и рамки",
      "Прямая печать в 300 dpi",
      "Все будущие обновления",
    ],
    sortOrder: 2,
  },
  {
    code: "yillik",
    name: "Годовой",
    description: "Заплатите за год вперёд и сэкономьте больше двух месяцев.",
    priceSom: 3990,
    days: 365,
    exportLimit: null,
    features: [
      "Безлимитный экспорт 365 дней",
      "Всё то же, что в тарифе Стандарт",
      "На ~33% дешевле помесячной оплаты",
      "Цена не меняется весь год",
    ],
    sortOrder: 3,
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL не задан.");

  const db = new PrismaClient({ adapter: new PrismaPg(poolConfig(connectionString)) });

  for (const plan of PLANS) {
    await db.plan.upsert({
      where: { code: plan.code },
      create: plan,
      update: plan,
    });
    console.log(`  тариф  ${plan.code.padEnd(12)} ${plan.priceSom} сом / ${plan.days} дн.`);
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (email && password) {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      console.log(`  admin  ${email} уже существует — не тронут`);
    } else {
      await db.user.create({
        data: {
          email,
          name: "Superadmin",
          role: "SUPERADMIN",
          passwordHash: await hashPassword(password),
        },
      });
      console.log(`  admin  ${email} yaratildi (SUPERADMIN)`);
    }
  } else {
    console.log("  admin  o'tkazib yuborildi — SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD berilmagan");
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
