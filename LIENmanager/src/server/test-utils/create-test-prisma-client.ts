import fs from "node:fs";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

// テスト専用: メモリ上のSQLiteにprisma/migrations配下の全マイグレーションを
// フォルダ名(タイムスタンプ)昇順で流し込んだPrismaClientを作る。
// 実データ(dev.db)には一切触れない。
export async function createTestPrismaClient(): Promise<PrismaClient> {
  const adapter = new PrismaBetterSqlite3({ url: ":memory:" });
  const prisma = new PrismaClient({ adapter });

  const migrationDirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const dir of migrationDirs) {
    const migrationSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, dir, "migration.sql"),
      "utf-8"
    );
    const statements = migrationSql
      .split(";")
      .map((chunk) =>
        chunk
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim()
      )
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
  }

  return prisma;
}
