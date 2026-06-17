export type WordGestureLabel = 'REST' | 'YES' | 'WHERE' | 'FEEL' | 'NAME';

export type AlphabetGestureLabel = 'A' | 'B' | 'C' | 'D' | 'F' | 'I' | 'L' | 'M' | 'U' | 'V' | 'Y';

export type GestureLabel = WordGestureLabel | AlphabetGestureLabel;

export type GestureMode = 'DEFAULT_ASL' | 'CUSTOM' | 'ALPHABET' | 'BOTH_HANDS';

export type GesturePhrase = {
  id: string;
  profileId: string;
  label: GestureLabel;
  phrase: string;
  speakEnabled: boolean;
  updatedAt: string;
};

export type GesturePhraseTranslation = {
  id: string;
  profileId: string;
  label: GestureLabel;
  languageCode: string;
  phrase: string;
  updatedAt: string;
};

export type GestureProfile = {
  id: string;
  name: string;
  mode: GestureMode;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
};

export type DetectionEvent = {
  id: string;
  label: GestureLabel | string;
  phrase: string;
  languageCode: string;
  confidence?: number;
  timestamp: string;
};

export type SpeechLanguage = {
  code: string;
  name: string;
  nativeName: string;
};

export type GestureMessage = {
  type: 'gesture_detected' | 'system_state';
  label?: GestureLabel | string;
  leftLabel?: GestureLabel | string;
  rightLabel?: GestureLabel | string;
  confidence?: number;
  leftConfidence?: number;
  rightConfidence?: number;
  state?: 'READY' | 'WAITING_FOR_REST' | string;
  timestamp?: string;
  fingers?: number[];
  leftFingers?: number[];
  rightFingers?: number[];
  raw?: string;
};
