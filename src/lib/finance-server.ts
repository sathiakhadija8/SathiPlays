import { type RowDataPacket } from 'mysql2';
import pool from './db';

export const FINANCE_CATEGORIES = ['Food', 'Travel', 'Beauty', 'Bills', 'Health', 'Shopping', 'Gifts', 'Other'] as const;

export type FinanceDirection = 'expense' | 'income';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|[12]\d|3[01])$/;

let initPromise: Promise<void> | null = null;

export async function ensureFinanceTables() {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(120) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS finance_budgets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          month CHAR(7) NOT NULL,
          total_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_month (user_id, month),
          KEY idx_user_month (user_id, month),
          CONSTRAINT fk_finance_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS finance_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          direction ENUM('expense','income') NOT NULL,
          category VARCHAR(80) NOT NULL,
          note VARCHAR(255) NULL,
          date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_user_date (user_id, date),
          CONSTRAINT fk_finance_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS finance_category_budgets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          month CHAR(7) NOT NULL,
          category VARCHAR(80) NOT NULL,
          limit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_month_category (user_id, month, category),
          KEY idx_user_month_category (user_id, month, category),
          CONSTRAINT fk_finance_category_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`INSERT IGNORE INTO users (id, username) VALUES (1, 'demo')`);
    })();
  }

  await initPromise;
}

export function getDemoUserId() {
  return 1;
}

export function nowMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function isValidMonth(month: string) {
  return MONTH_RE.test(month);
}

export function isValidIsoDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function parseMoney(input: unknown) {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function monthStartEnd(month: string) {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 1);
  return { start, end };
}

export function formatDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function weekStartMonday(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type CategorySpendRow = RowDataPacket & { category: string; amount: number | null };
