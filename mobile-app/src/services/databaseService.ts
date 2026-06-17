import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite/next';
import { createDefaultPhrases, createDefaultProfiles, createDefaultTranslations, DEFAULT_SPEECH_LANGUAGE, DEFAULT_WS_URL } from '../constants/defaultProfiles';

let dbPromise: Promise<SQLiteDatabase> | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('smart_glove_asl.db');
  }
  return dbPromise;
}

async function initializeDatabase(): Promise<SQLiteDatabase> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS phrases (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      label TEXT NOT NULL,
      phrase TEXT NOT NULL,
      speak_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS detection_history (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      phrase TEXT NOT NULL,
      language_code TEXT NOT NULL DEFAULT 'en-US',
      confidence REAL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS phrase_translations (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      label TEXT NOT NULL,
      language_code TEXT NOT NULL,
      phrase TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(profile_id, label, language_code)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try {
    await db.execAsync("ALTER TABLE detection_history ADD COLUMN language_code TEXT NOT NULL DEFAULT 'en-US';");
  } catch {
    // Column already exists.
  }

  // Purge legacy ASL word profiles and phrases (no @ in ID) from database
  try {
    await db.runAsync("DELETE FROM profiles WHERE instr(id, '@') = 0;");
    await db.runAsync("DELETE FROM phrases WHERE instr(profile_id, '@') = 0;");
    await db.runAsync("DELETE FROM phrase_translations WHERE instr(profile_id, '@') = 0;");
  } catch (err) {
    // Tables might not exist or be loaded.
  }

  await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'speech_language_code', DEFAULT_SPEECH_LANGUAGE);
  await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'speech_voice_id', '');


  return db;
}

export async function initDatabase(): Promise<SQLiteDatabase> {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export const databaseService = {
  getDb: initDatabase,
};
