export type GestureLabel = 'REST' | 'YES' | 'WHERE' | 'FEEL' | 'NAME';

export type GestureMode = 'DEFAULT_ASL' | 'CUSTOM';

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
  label: GestureLabel;
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
  label?: GestureLabel;
  confidence?: number;
  state?: 'READY' | 'WAITING_FOR_REST' | string;
  timestamp?: string;
  fingers?: number[];
  raw?: string;
};
