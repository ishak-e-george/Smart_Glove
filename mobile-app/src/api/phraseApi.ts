import client from './client';

export interface Phrase {
  id: number;
  gesture_id: number;
  language_code: string;
  phrase_text: string;
  is_default: boolean;
}

export const phraseApi = {
  getPhrasesByGesture: async (gestureId: number, languageCode: string = 'en'): Promise<Phrase[]> => {
    const response = await client.get(`/phrases/by-gesture/${gestureId}`, {
      params: {
        language_code: languageCode,
      },
    });
    return response.data;
  },
};
