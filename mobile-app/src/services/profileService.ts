import {
  ASL_ALPHABET_LABELS,
  createDefaultPhrases,
  createDefaultProfiles,
  createDefaultTranslations,
  DEFAULT_ASL_PROFILE_ID,
  DEFAULT_SPEECH_LANGUAGE,
} from '../constants/defaultProfiles';
import { databaseService } from './databaseService';
import { sessionService } from './sessionService';
import { GestureLabel, GestureMode, GesturePhrase, GesturePhraseTranslation, GestureProfile } from '../types/gesture';

type ProfileRow = {
  id: string;
  name: string;
  mode: GestureMode;
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

let seedingPromise: Promise<void> | null = null;

async function loadState(): Promise<ProfileState> {
  const db = await databaseService.getDb();
  const email = sessionService.getEmail();
  const prefix = `${email}_`;

  // Check if profiles exist for this user email
  const rows = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM profiles WHERE id LIKE ?',
    `${prefix}%`
  );
  const count = rows[0]?.count ?? 0;

  if (count === 0) {
    if (!seedingPromise) {
      seedingPromise = (async () => {
        const defaultProfiles = createDefaultProfiles();
        const defaultPhrases = createDefaultPhrases();
        const defaultTranslations = createDefaultTranslations();

        await db.withTransactionAsync(async () => {
          for (const p of defaultProfiles) {
            await db.runAsync(
              'INSERT OR IGNORE INTO profiles (id, name, mode, is_active, is_locked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              `${prefix}${p.id}`,
              p.name,
              p.mode,
              p.isActive ? 1 : 0,
              p.isLocked ? 1 : 0,
              p.createdAt
            );
          }
          for (const phrase of defaultPhrases) {
            await db.runAsync(
              'INSERT OR IGNORE INTO phrases (id, profile_id, label, phrase, speak_enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
              `${prefix}${phrase.id}`,
              `${prefix}${phrase.profileId}`,
              phrase.label,
              phrase.phrase,
              phrase.speakEnabled ? 1 : 0,
              phrase.updatedAt
            );
          }
          for (const trans of defaultTranslations) {
            await db.runAsync(
              'INSERT OR IGNORE INTO phrase_translations (id, profile_id, label, language_code, phrase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
              `${prefix}${trans.id}`,
              `${prefix}${trans.profileId}`,
              trans.label,
              trans.languageCode,
              trans.phrase,
              trans.updatedAt
            );
          }
        });
      })().finally(() => {
        seedingPromise = null;
      });
    }
    await seedingPromise;
  }

  const [profiles, phrases] = await Promise.all([
    db.getAllAsync<ProfileRow>(
      'SELECT * FROM profiles WHERE id LIKE ? ORDER BY is_locked DESC, created_at ASC',
      `${prefix}%`
    ),
    db.getAllAsync<PhraseRow>(
      'SELECT * FROM phrases WHERE profile_id LIKE ? ORDER BY profile_id ASC, label ASC',
      `${prefix}%`
    ),
  ]);

  return {
    profiles: profiles.map((p) => {
      const mapped = mapProfile(p);
      if (mapped.id.startsWith(prefix)) {
        mapped.id = mapped.id.substring(prefix.length);
      }
      return mapped;
    }),
    phrases: phrases.map((ph) => {
      const mapped = mapPhrase(ph);
      if (mapped.id.startsWith(prefix)) {
        mapped.id = mapped.id.substring(prefix.length);
      }
      if (mapped.profileId.startsWith(prefix)) {
        mapped.profileId = mapped.profileId.substring(prefix.length);
      }
      return mapped;
    }),
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
    const email = sessionService.getEmail();
    const prefix = `${email}_`;

    // Seed profiles first if they don't exist for this email prefix
    const rows = await db.getAllAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM profiles WHERE id LIKE ?',
      `${prefix}%`
    );
    const count = rows[0]?.count ?? 0;
    if (count === 0) {
      await loadState();
    }

    const userProfileId = `${prefix}${profileId}`;
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE profiles SET is_active = 0 WHERE id LIKE ?', `${prefix}%`);
      await db.runAsync('UPDATE profiles SET is_active = 1 WHERE id = ?', userProfileId);
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', `${email}_active_profile_id`, userProfileId);
    });
    return loadState();
  },

  async getPhraseForLabel(label: GestureLabel): Promise<GesturePhrase> {
    const active = await this.getActiveProfile();
    const db = await databaseService.getDb();
    const email = sessionService.getEmail();
    const prefix = `${email}_`;
    const userActiveProfileId = `${prefix}${active.id}`;

    const rows = await db.getAllAsync<PhraseRow>(
      'SELECT * FROM phrases WHERE profile_id = ? AND label = ? LIMIT 1',
      userActiveProfileId,
      label,
    );

    if (rows[0]) {
      const phrase = mapPhrase(rows[0]);
      if (phrase.id.startsWith(prefix)) {
        phrase.id = phrase.id.substring(prefix.length);
      }
      if (phrase.profileId.startsWith(prefix)) {
        phrase.profileId = phrase.profileId.substring(prefix.length);
      }
      return phrase;
    }

    if (ASL_ALPHABET_LABELS.includes(label as any)) {
      return {
        id: `${active.id}_${label}`,
        profileId: active.id,
        label,
        phrase: label,
        speakEnabled: true,
        updatedAt: new Date().toISOString(),
      };
    }

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
    const email = sessionService.getEmail();
    const prefix = `${email}_`;
    const userProfileId = `${prefix}${profileId}`;

    const rows = await db.getAllAsync<TranslationRow>(
      'SELECT * FROM phrase_translations WHERE profile_id = ? AND label = ? AND language_code = ? LIMIT 1',
      userProfileId,
      label,
      languageCode,
    );

    if (rows[0]) {
      const trans = mapTranslation(rows[0]);
      if (trans.id.startsWith(prefix)) {
        trans.id = trans.id.substring(prefix.length);
      }
      if (trans.profileId.startsWith(prefix)) {
        trans.profileId = trans.profileId.substring(prefix.length);
      }
      return trans;
    }

    const fallback = await db.getAllAsync<TranslationRow>(
      'SELECT * FROM phrase_translations WHERE profile_id = ? AND label = ? AND language_code = ? LIMIT 1',
      userProfileId,
      label,
      DEFAULT_SPEECH_LANGUAGE,
    );

    if (fallback[0]) {
      const trans = mapTranslation(fallback[0]);
      if (trans.id.startsWith(prefix)) {
        trans.id = trans.id.substring(prefix.length);
      }
      if (trans.profileId.startsWith(prefix)) {
        trans.profileId = trans.profileId.substring(prefix.length);
      }
      return trans;
    }

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
    const email = sessionService.getEmail();
    const prefix = `${email}_`;
    const userProfileId = `${prefix}${profileId}`;

    const rows = await db.getAllAsync<TranslationRow>(
      'SELECT * FROM phrase_translations WHERE profile_id = ? AND language_code = ? ORDER BY label ASC',
      userProfileId,
      languageCode,
    );
    return rows.map((r) => {
      const trans = mapTranslation(r);
      if (trans.id.startsWith(prefix)) {
        trans.id = trans.id.substring(prefix.length);
      }
      if (trans.profileId.startsWith(prefix)) {
        trans.profileId = trans.profileId.substring(prefix.length);
      }
      return trans;
    });
  },

  async updatePhraseTranslation(profileId: string, label: GestureLabel, languageCode: string, phrase: string): Promise<GesturePhraseTranslation> {
    const db = await databaseService.getDb();
    const email = sessionService.getEmail();
    const prefix = `${email}_`;
    const userProfileId = `${prefix}${profileId}`;
    const now = new Date().toISOString();
    const id = `${userProfileId}_${label}_${languageCode}`;

    await db.runAsync(
      'INSERT OR REPLACE INTO phrase_translations (id, profile_id, label, language_code, phrase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      userProfileId,
      label,
      languageCode,
      phrase,
      now,
    );
    return {
      id: `${profileId}_${label}_${languageCode}`,
      profileId,
      label,
      languageCode,
      phrase,
      updatedAt: now,
    };
  },

  async updatePhrase(profileId: string, label: GestureLabel, phrase: string, speakEnabled: boolean): Promise<ProfileState> {
    const db = await databaseService.getDb();
    const email = sessionService.getEmail();
    const prefix = `${email}_`;
    const userProfileId = `${prefix}${profileId}`;

    await db.runAsync(
      'UPDATE phrases SET phrase = ?, speak_enabled = ?, updated_at = ? WHERE profile_id = ? AND label = ?',
      phrase,
      speakEnabled ? 1 : 0,
      new Date().toISOString(),
      userProfileId,
      label,
    );
    return loadState();
  },

  async reset(): Promise<ProfileState> {
    const db = await databaseService.getDb();
    const email = sessionService.getEmail();
    const prefix = `${email}_`;
    const profiles = createDefaultProfiles();
    const phrases = createDefaultPhrases();
    const translations = createDefaultTranslations();

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM phrase_translations WHERE profile_id LIKE ?', `${prefix}%`);
      await db.runAsync('DELETE FROM phrases WHERE profile_id LIKE ?', `${prefix}%`);
      await db.runAsync('DELETE FROM profiles WHERE id LIKE ?', `${prefix}%`);
      for (const profile of profiles) {
        await db.runAsync(
          'INSERT INTO profiles (id, name, mode, is_active, is_locked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          `${prefix}${profile.id}`,
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
          `${prefix}${item.id}`,
          `${prefix}${item.profileId}`,
          item.label,
          item.phrase,
          item.speakEnabled ? 1 : 0,
          item.updatedAt,
        );
      }
      for (const item of translations) {
        await db.runAsync(
          'INSERT INTO phrase_translations (id, profile_id, label, language_code, phrase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          `${prefix}${item.id}`,
          `${prefix}${item.profileId}`,
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
