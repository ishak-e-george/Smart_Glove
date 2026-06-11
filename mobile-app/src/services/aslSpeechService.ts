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
    try {
      await Speech.stop();
      Speech.speak(phrase, {
        language: languageCode,
        voice: voiceId || undefined,
        pitch: 1,
        rate: 0.9,
      });
    } catch {
      // Some emulator images do not have every requested TTS voice installed.
    }
  },

  repeat(languageCode = 'en-US', voiceId = ''): void {
    if (!lastPhrase || muted) return;
    Speech.stop()
      .catch(() => undefined)
      .finally(() => {
        Speech.speak(lastPhrase, {
          language: languageCode,
          voice: voiceId || undefined,
          pitch: 1,
          rate: 0.9,
        });
      });
  },

  stop(): void {
    Speech.stop().catch(() => undefined);
  },
};
