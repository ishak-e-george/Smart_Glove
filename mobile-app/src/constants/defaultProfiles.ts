import { GestureLabel, GesturePhrase, GesturePhraseTranslation, GestureProfile, SpeechLanguage } from '../types/gesture';

export const GESTURE_LABELS: GestureLabel[] = ['REST', 'YES', 'WHERE', 'FEEL', 'NAME'];

export const DEFAULT_ASL_PROFILE_ID = 'default_asl';
export const CUSTOM_PROFILE_ID = 'custom_phrase_profile';

export const DEFAULT_WS_URL = 'ws://10.0.2.2:8765';

export const DEFAULT_SPEECH_LANGUAGE = 'en-US';

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguage[] = [
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français' },
];

export const DEFAULT_ASL_PHRASES: Record<GestureLabel, string> = {
  REST: '',
  YES: 'Yes',
  WHERE: 'Where?',
  FEEL: 'I feel',
  NAME: 'My name is...',
};

export const CUSTOM_PHRASES: Record<GestureLabel, string> = {
  REST: '',
  YES: 'Yes, I need help',
  WHERE: 'Where is my medicine?',
  FEEL: 'I feel pain',
  NAME: 'My name is Sarah',
};

export const DEFAULT_TRANSLATIONS: Record<string, Record<GestureLabel, string>> = {
  'en-US': {
    REST: '',
    YES: 'Yes',
    WHERE: 'Where?',
    FEEL: 'I feel',
    NAME: 'My name is...',
  },
  'ar-SA': {
    REST: '',
    YES: 'نعم',
    WHERE: 'أين؟',
    FEEL: 'أنا أشعر',
    NAME: 'اسمي',
  },
  'fr-FR': {
    REST: '',
    YES: 'Oui',
    WHERE: 'Où ?',
    FEEL: 'Je ressens',
    NAME: "Je m'appelle",
  },
};

export const CUSTOM_TRANSLATIONS: Record<string, Record<GestureLabel, string>> = {
  'en-US': CUSTOM_PHRASES,
  'ar-SA': {
    REST: '',
    YES: 'نعم، أحتاج إلى مساعدة',
    WHERE: 'أين دوائي؟',
    FEEL: 'أنا أشعر بالألم',
    NAME: 'اسمي سارة',
  },
  'fr-FR': {
    REST: '',
    YES: "Oui, j'ai besoin d'aide",
    WHERE: 'Où est mon médicament ?',
    FEEL: "J'ai mal",
    NAME: "Je m'appelle Sarah",
  },
};

export function createDefaultProfiles(now = new Date().toISOString()): GestureProfile[] {
  return [
    {
      id: DEFAULT_ASL_PROFILE_ID,
      name: 'Default ASL Profile',
      mode: 'DEFAULT_ASL',
      isActive: true,
      isLocked: true,
      createdAt: now,
    },
    {
      id: CUSTOM_PROFILE_ID,
      name: 'Custom Phrase Profile',
      mode: 'CUSTOM',
      isActive: false,
      isLocked: false,
      createdAt: now,
    },
  ];
}

export function createDefaultPhrases(now = new Date().toISOString()): GesturePhrase[] {
  const defaults = Object.entries(DEFAULT_ASL_PHRASES).map(([label, phrase]) => ({
    id: `${DEFAULT_ASL_PROFILE_ID}_${label}`,
    profileId: DEFAULT_ASL_PROFILE_ID,
    label: label as GestureLabel,
    phrase,
    speakEnabled: label !== 'REST',
    updatedAt: now,
  }));

  const custom = Object.entries(CUSTOM_PHRASES).map(([label, phrase]) => ({
    id: `${CUSTOM_PROFILE_ID}_${label}`,
    profileId: CUSTOM_PROFILE_ID,
    label: label as GestureLabel,
    phrase,
    speakEnabled: label !== 'REST',
    updatedAt: now,
  }));

  return [...defaults, ...custom];
}

export function createDefaultTranslations(now = new Date().toISOString()): GesturePhraseTranslation[] {
  const rows: GesturePhraseTranslation[] = [];

  for (const [languageCode, translations] of Object.entries(DEFAULT_TRANSLATIONS)) {
    for (const [label, phrase] of Object.entries(translations)) {
      rows.push({
        id: `${DEFAULT_ASL_PROFILE_ID}_${label}_${languageCode}`,
        profileId: DEFAULT_ASL_PROFILE_ID,
        label: label as GestureLabel,
        languageCode,
        phrase,
        updatedAt: now,
      });
    }
  }

  for (const [languageCode, translations] of Object.entries(CUSTOM_TRANSLATIONS)) {
    for (const [label, phrase] of Object.entries(translations)) {
      rows.push({
        id: `${CUSTOM_PROFILE_ID}_${label}_${languageCode}`,
        profileId: CUSTOM_PROFILE_ID,
        label: label as GestureLabel,
        languageCode,
        phrase,
        updatedAt: now,
      });
    }
  }

  return rows;
}
