import { createDefaultPhrases, createDefaultProfiles, createDefaultTranslations, DEFAULT_ASL_PROFILE_ID, DEFAULT_SPEECH_LANGUAGE } from '../constants/defaultProfiles';
import { databaseService } from './databaseService';
import { GestureLabel, GesturePhrase, GesturePhraseTranslation, GestureProfile } from '../types/gesture';

type ProfileRow = {
  id: string;
  name: string;
  mode: 'DEFAULT_ASL' | 'CUSTOM';
  is_active: number;
  is_locked: number;
  created_at: string;
};

type PhraseRow = {
  id: string;
  profile_id: string;
  label: GestureLabel;
  phrase: string;
  speak_enabled: number;
  updated_at: string;
};

type TranslationRow = {
  id: string;
  profile_id: string;
  label: GestureLabel;
  language_code: string;
  phrase: string;
  updated_at: string;
};

type ProfileState = {
  profiles: GestureProfile[];
  phrases: GesturePhrase[];
};

function mapProfile(row: ProfileRow): GestureProfile {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    isActive: row.is_active === 1,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
  };
}

function mapPhrase(row: PhraseRow): GesturePhrase {
  return {
    id: row.id,
    profileId: row.profile_id,
    label: row.label,
    phrase: row.phrase,
    speakEnabled: row.speak_enabled === 1,
    updatedAt: row.updated_at,
  };
}

function mapTranslation(row: TranslationRow): GesturePhraseTranslation {
  return {
    id: row.id,
    profileId: row.profile_id,
    label: row.label,
    languageCode: row.language_code,
    phrase: row.phrase,
    updatedAt: row.updated_at,
  };
}

async function loadState(): Promise<ProfileState> {
  const db = await databaseService.getDb();
  const [profiles, phrases] = await Promise.all([
    db.getAllAsync<ProfileRow>('SELECT * FROM profiles ORDER BY is_locked DESC, created_at ASC'),
    db.getAllAsync<PhraseRow>('SELECT * FROM phrases ORDER BY profile_id ASC, label ASC'),
  ]);
  return {
    profiles: profiles.map(mapProfile),
    phrases: phrases.map(mapPhrase),
  };
}

export const profileService = {
  async getState(): Promise<ProfileState> {
    return loadState();
  },

  async getActiveProfile(): Promise<GestureProfile> {
    const state = await loadState();
    return state.profiles.find((profile) => profile.isActive) ?? state.profiles[0];
  },

  async activateProfile(profileId: string): Promise<ProfileState> {
    const db = await databaseService.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE profiles SET is_active = 0');
      await db.runAsync('UPDATE profiles SET is_active = 1 WHERE id = ?', profileId);
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'active_profile_id', profileId);
    });
    return loadState();
  },

  async getPhraseForLabel(label: GestureLabel): Promise<GesturePhrase> {
    const active = await this.getActiveProfile();
    const db = await databaseService.getDb();
    const rows = await db.getAllAsync<PhraseRow>(
      'SELECT * FROM phrases WHERE profile_id = ? AND label = ? LIMIT 1',
      active.id,
      label,
    );

    if (rows[0]) return mapPhrase(rows[0]);

    return {
      id: `${DEFAULT_ASL_PROFILE_ID}_${label}`,
      profileId: DEFAULT_ASL_PROFILE_ID,
      label,
      phrase: '',
      speakEnabled: false,
      updatedAt: new Date().toISOString(),
    };
  },

  async getPhraseTranslation(profileId: string, label: GestureLabel, languageCode: string): Promise<GesturePhraseTranslation> {
    const db = await databaseService.getDb();
    const rows = await db.getAllAsync<TranslationRow>(
      'SELECT * FROM phrase_translations WHERE profile_id = ? AND label = ? AND language_code = ? LIMIT 1',
      profileId,
      label,
      languageCode,
    );

    if (rows[0]) return mapTranslation(rows[0]);

    const fallback = await db.getAllAsync<TranslationRow>(
      'SELECT * FROM phrase_translations WHERE profile_id = ? AND label = ? AND language_code = ? LIMIT 1',
      profileId,
      label,
      DEFAULT_SPEECH_LANGUAGE,
    );

    if (fallback[0]) return mapTranslation(fallback[0]);

    const phrase = await this.getPhraseForLabel(label);
    return {
      id: `${profileId}_${label}_${languageCode}`,
      profileId,
      label,
      languageCode,
      phrase: phrase.phrase,
      updatedAt: new Date().toISOString(),
    };
  },

  async getTranslationsForProfileLanguage(profileId: string, languageCode: string): Promise<GesturePhraseTranslation[]> {
    const db = await databaseService.getDb();
    const rows = await db.getAllAsync<TranslationRow>(
      'SELECT * FROM phrase_translations WHERE profile_id = ? AND language_code = ? ORDER BY label ASC',
      profileId,
      languageCode,
    );
    return rows.map(mapTranslation);
  },

  async updatePhraseTranslation(profileId: string, label: GestureLabel, languageCode: string, phrase: string): Promise<GesturePhraseTranslation> {
    const db = await databaseService.getDb();
    const now = new Date().toISOString();
    const id = `${profileId}_${label}_${languageCode}`;
    await db.runAsync(
      'INSERT OR REPLACE INTO phrase_translations (id, profile_id, label, language_code, phrase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      profileId,
      label,
      languageCode,
      phrase,
      now,
    );
    return {
      id,
      profileId,
      label,
      languageCode,
      phrase,
      updatedAt: now,
    };
  },

  async updatePhrase(profileId: string, label: GestureLabel, phrase: string, speakEnabled: boolean): Promise<ProfileState> {
    const db = await databaseService.getDb();
    await db.runAsync(
      'UPDATE phrases SET phrase = ?, speak_enabled = ?, updated_at = ? WHERE profile_id = ? AND label = ?',
      phrase,
      speakEnabled ? 1 : 0,
      new Date().toISOString(),
      profileId,
      label,
    );
    return loadState();
  },

  async reset(): Promise<ProfileState> {
    const db = await databaseService.getDb();
    const profiles = createDefaultProfiles();
    const phrases = createDefaultPhrases();
    const translations = createDefaultTranslations();

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM phrase_translations');
      await db.runAsync('DELETE FROM phrases');
      await db.runAsync('DELETE FROM profiles');
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
      for (const item of phrases) {
        await db.runAsync(
          'INSERT INTO phrases (id, profile_id, label, phrase, speak_enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          item.id,
          item.profileId,
          item.label,
          item.phrase,
          item.speakEnabled ? 1 : 0,
          item.updatedAt,
        );
      }
      for (const item of translations) {
        await db.runAsync(
          'INSERT INTO phrase_translations (id, profile_id, label, language_code, phrase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          item.id,
          item.profileId,
          item.label,
          item.languageCode,
          item.phrase,
          item.updatedAt,
        );
      }
    });

    return loadState();
  },
};
