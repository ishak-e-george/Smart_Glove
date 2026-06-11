import * as Speech from 'expo-speech';

let muted = false;
let lastPhrase = '';

export const aslSpeechService = {
  isMuted(): boolean {
    return muted;
  },

  setMuted(value: boolean): void {
    muted = value;
    if (muted) {
      Speech.stop();
    }
  },

  async speak(phrase: string, languageCode = 'en-US', voiceId = ''): Promise<void> {
    if (!phrase || muted) return;
    lastPhrase = phrase;
    Speech.stop();
    Speech.speak(phrase, {
      language: languageCode,
      voice: voiceId || undefined,
      pitch: 1,
      rate: 0.9,
    });
  },

  repeat(languageCode = 'en-US', voiceId = ''): void {
    if (!lastPhrase || muted) return;
    Speech.stop();
    Speech.speak(lastPhrase, {
      language: languageCode,
      voice: voiceId || undefined,
      pitch: 1,
      rate: 0.9,
    });
  },

  stop(): void {
    Speech.stop();
  },
};
