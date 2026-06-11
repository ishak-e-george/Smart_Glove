import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite/next';
import { createDefaultPhrases, createDefaultProfiles, createDefaultTranslations, DEFAULT_SPEECH_LANGUAGE, DEFAULT_WS_URL } from '../constants/defaultProfiles';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('smart_glove_asl.db');
  }
  return dbPromise;
}

export async function initDatabase(): Promise<SQLiteDatabase> {
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

  const existing = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM profiles');
  if ((existing[0]?.count ?? 0) === 0) {
    const profiles = createDefaultProfiles();
    const phrases = createDefaultPhrases();
    const translations = createDefaultTranslations();

    await db.withTransactionAsync(async () => {
      for (const profile of profiles) {
        await db.runAsync(
          'INSERT INTO profiles (id, name, mode, is_active, is_locked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          profile.id,
          profile.name,
          profile.mode,
          profile.isActive ? 1 : 0,
          profile.isLocked ? 1 : 0,
          profile.createdAt,
        );
      }

      for (const phrase of phrases) {
        await db.runAsync(
          'INSERT INTO phrases (id, profile_id, label, phrase, speak_enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          phrase.id,
          phrase.profileId,
          phrase.label,
          phrase.phrase,
          phrase.speakEnabled ? 1 : 0,
          phrase.updatedAt,
        );
      }

      for (const translation of translations) {
        await db.runAsync(
          'INSERT OR REPLACE INTO phrase_translations (id, profile_id, label, language_code, phrase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          translation.id,
          translation.profileId,
          translation.label,
          translation.languageCode,
          translation.phrase,
          translation.updatedAt,
        );
      }

      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'websocket_url', DEFAULT_WS_URL);
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'auto_connect', 'false');
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'show_raw_messages', 'true');
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'speech_language_code', DEFAULT_SPEECH_LANGUAGE);
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'speech_voice_id', '');
    });
  }

  const translationCount = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM phrase_translations');
  if ((translationCount[0]?.count ?? 0) === 0) {
    const translations = createDefaultTranslations();
    await db.withTransactionAsync(async () => {
      for (const translation of translations) {
        await db.runAsync(
          'INSERT OR REPLACE INTO phrase_translations (id, profile_id, label, language_code, phrase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          translation.id,
          translation.profileId,
          translation.label,
          translation.languageCode,
          translation.phrase,
          translation.updatedAt,
        );
      }
    });
  }

  await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'speech_language_code', DEFAULT_SPEECH_LANGUAGE);
  await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'speech_voice_id', '');

  return db;
}

export const databaseService = {
  getDb: initDatabase,
};
