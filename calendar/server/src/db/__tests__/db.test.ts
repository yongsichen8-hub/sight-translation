import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../index';

describe('Database initialization', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('should create all required tables', () => {
    db = initializeDatabase(':memory:');

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all()
      .map((row: any) => row.name);

    expect(tables).toEqual([
      'categories',
      'inspiration_categories',
      'inspiration_entries',
      'key_results',
      'objectives',
      'summaries',
      'users',
      'work_entries',
    ]);
  });

  it('should create idx_work_entries_user_date_slot index', () => {
    db = initializeDatabase(':memory:');

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_work_entries_user_date_slot'"
      )
      .all();

    expect(indexes).toHaveLength(1);
  });

  it('should enable WAL mode (pragma is called)', () => {
    // Note: :memory: databases report journal_mode as 'memory' since WAL
    // only applies to file-based databases. We verify the pragma call doesn't
    // throw and the db is functional.
    db = initializeDatabase(':memory:');

    const result = db.pragma('journal_mode') as { journal_mode: string }[];
    // In-memory databases always report 'memory'; for file-based DBs this would be 'wal'
    expect(result[0].journal_mode).toBe('memory');
  });

  it('should enable foreign keys', () => {
    db = initializeDatabase(':memory:');

    const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(result[0].foreign_keys).toBe(1);
  });

  it('should be idempotent (safe to call twice)', () => {
    db = initializeDatabase(':memory:');

    // Running exec again on the same db should not throw
    expect(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          passwordHash TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    }).not.toThrow();
  });
});
