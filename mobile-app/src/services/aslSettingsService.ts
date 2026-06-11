import { DEFAULT_SPEECH_LANGUAGE, DEFAULT_WS_URL } from '../constants/defaultProfiles';
import { databaseService } from './databaseService';

export type AslSettings = {
  websocketUrl: string;
  autoConnect: boolean;
  showRawMessages: boolean;
  speechLanguageCode: string;
  speechVoiceId: string;
};

async function getSetting(key: string): Promise<string | null> {
  const db = await databaseService.getDb();
  const rows = await db.getAllAsync<{ value: string }>('SELECT value FROM settings WHERE key = ? LIMIT 1', key);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await databaseService.getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

export const aslSettingsService = {
  async getSettings(): Promise<AslSettings> {
    const [websocketUrl, autoConnect, showRawMessages, speechLanguageCode, speechVoiceId] = await Promise.all([
      getSetting('websocket_url'),
      getSetting('auto_connect'),
      getSetting('show_raw_messages'),
      getSetting('speech_language_code'),
      getSetting('speech_voice_id'),
    ]);
    return {
      websocketUrl: websocketUrl ?? DEFAULT_WS_URL,
      autoConnect: autoConnect === 'true',
      showRawMessages: showRawMessages !== 'false',
      speechLanguageCode: speechLanguageCode ?? DEFAULT_SPEECH_LANGUAGE,
      speechVoiceId: speechVoiceId ?? '',
    };
  },

  async saveSettings(settings: AslSettings): Promise<void> {
    await Promise.all([
      setSetting('websocket_url', settings.websocketUrl),
      setSetting('auto_connect', String(settings.autoConnect)),
      setSetting('show_raw_messages', String(settings.showRawMessages)),
      setSetting('speech_language_code', settings.speechLanguageCode),
      setSetting('speech_voice_id', settings.speechVoiceId),
    ]);
  },
};
