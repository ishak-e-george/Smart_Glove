import { AlphabetGestureLabel, GestureLabel, GesturePhrase, GesturePhraseTranslation, GestureProfile, SpeechLanguage, WordGestureLabel } from '../types/gesture';

export const WORD_GESTURE_LABELS: WordGestureLabel[] = ['REST', 'YES', 'WHERE', 'FEEL', 'NAME'];

export const ASL_ALPHABET_LABELS: AlphabetGestureLabel[] = [
  'A', 'B', 'C', 'D', 'F', 'I', 'L', 'M', 'U', 'V', 'Y',
];

export const GESTURE_LABELS: GestureLabel[] = ASL_ALPHABET_LABELS;

export const DEFAULT_ASL_PROFILE_ID = 'default_asl';
export const CUSTOM_PROFILE_ID = 'custom_phrase_profile';
export const ALPHABET_PROFILE_ID = 'asl_alphabet_profile';
export const BOTH_HANDS_PROFILE_ID = 'both_hands_alphabet_profile';

export const DEFAULT_WS_URL = 'ws://10.0.2.2:8765';

export const DEFAULT_SPEECH_LANGUAGE = 'en-US';

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguage[] = [
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français' },
];

export const DEFAULT_ASL_PHRASES: Record<WordGestureLabel, string> = {
  REST: '',
  YES: 'Yes',
  WHERE: 'Where?',
  FEEL: 'I feel',
  NAME: 'My name is...',
};

export const CUSTOM_PHRASES: Record<WordGestureLabel, string> = {
  REST: '',
  YES: 'Yes, I need help',
  WHERE: 'Where is my medicine?',
  FEEL: 'I feel pain',
  NAME: 'My name is Sarah',
};

export const ALPHABET_PHRASES: Record<AlphabetGestureLabel, string> = ASL_ALPHABET_LABELS.reduce(
  (acc, label) => ({ ...acc, [label]: label }),
  {} as Record<AlphabetGestureLabel, string>,
);

export const DEFAULT_TRANSLATIONS: Record<string, Record<WordGestureLabel, string>> = {
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

export const CUSTOM_TRANSLATIONS: Record<string, Record<WordGestureLabel, string>> = {
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

export const ALPHABET_TRANSLATIONS: Record<string, Partial<Record<AlphabetGestureLabel, string>>> = {
  'en-US': ALPHABET_PHRASES,
  'ar-SA': {
    A: 'أ',
    B: 'ب',
    C: 'ج',
    L: 'ل',
  },
  'fr-FR': ALPHABET_PHRASES,
};

export function createDefaultProfiles(now = new Date().toISOString()): GestureProfile[] {
  return [
    {
      id: ALPHABET_PROFILE_ID,
      name: 'ASL Alphabet Profile',
      mode: 'ALPHABET',
      isActive: true,
      isLocked: true,
      createdAt: now,
    },
    {
      id: CUSTOM_PROFILE_ID,
      name: 'My Custom Profile',
      mode: 'CUSTOM',
      isActive: false,
      isLocked: false,
      createdAt: now,
    },
    {
      id: BOTH_HANDS_PROFILE_ID,
      name: 'Both Hands Alphabet Profile',
      mode: 'BOTH_HANDS',
      isActive: false,
      isLocked: true,
      createdAt: now,
    },
  ];
}

export function createDefaultPhrases(now = new Date().toISOString()): GesturePhrase[] {
  const alphabet = Object.entries(ALPHABET_PHRASES).map(([label, phrase]) => ({
    id: `${ALPHABET_PROFILE_ID}_${label}`,
    profileId: ALPHABET_PROFILE_ID,
    label: label as GestureLabel,
    phrase,
    speakEnabled: true,
    updatedAt: now,
  }));

  const custom = Object.entries(ALPHABET_PHRASES).map(([label, phrase]) => ({
    id: `${CUSTOM_PROFILE_ID}_${label}`,
    profileId: CUSTOM_PROFILE_ID,
    label: label as GestureLabel,
    phrase,
    speakEnabled: true,
    updatedAt: now,
  }));

  const bothHands = Object.entries(ALPHABET_PHRASES).map(([label, phrase]) => ({
    id: `${BOTH_HANDS_PROFILE_ID}_${label}`,
    profileId: BOTH_HANDS_PROFILE_ID,
    label: label as GestureLabel,
    phrase,
    speakEnabled: true,
    updatedAt: now,
  }));

  return [...alphabet, ...custom, ...bothHands];
}

export function createDefaultTranslations(now = new Date().toISOString()): GesturePhraseTranslation[] {
  const rows: GesturePhraseTranslation[] = [];

  for (const [languageCode, translations] of Object.entries(ALPHABET_TRANSLATIONS)) {
    for (const [label, phrase] of Object.entries(translations)) {
      rows.push({
        id: `${ALPHABET_PROFILE_ID}_${label}_${languageCode}`,
        profileId: ALPHABET_PROFILE_ID,
        label: label as GestureLabel,
        languageCode,
        phrase,
        updatedAt: now,
      });
      rows.push({
        id: `${CUSTOM_PROFILE_ID}_${label}_${languageCode}`,
        profileId: CUSTOM_PROFILE_ID,
        label: label as GestureLabel,
        languageCode,
        phrase,
        updatedAt: now,
      });
      rows.push({
        id: `${BOTH_HANDS_PROFILE_ID}_${label}_${languageCode}`,
        profileId: BOTH_HANDS_PROFILE_ID,
        label: label as GestureLabel,
        languageCode,
        phrase,
        updatedAt: now,
      });
    }
  }

  return rows;
}
