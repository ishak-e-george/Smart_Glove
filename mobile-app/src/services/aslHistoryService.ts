import { DetectionEvent } from '../types/gesture';
import { databaseService } from './databaseService';

const MAX_HISTORY = 100;

type DetectionRow = {
  id: string;
  label: DetectionEvent['label'];
  phrase: string;
  language_code: string;
  confidence: number | null;
  timestamp: string;
};

function mapRow(row: DetectionRow): DetectionEvent {
  return {
    id: row.id,
    label: row.label,
    phrase: row.phrase,
    languageCode: row.language_code,
    confidence: row.confidence ?? undefined,
    timestamp: row.timestamp,
  };
}

export const aslHistoryService = {
  async getRecent(): Promise<DetectionEvent[]> {
    const db = await databaseService.getDb();
    const rows = await db.getAllAsync<DetectionRow>(
      'SELECT * FROM detection_history ORDER BY timestamp DESC LIMIT ?',
      MAX_HISTORY,
    );
    return rows.map(mapRow);
  },

  async add(event: Omit<DetectionEvent, 'id' | 'timestamp'>): Promise<DetectionEvent[]> {
    const db = await databaseService.getDb();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO detection_history (id, label, phrase, language_code, confidence, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      event.label,
      event.phrase,
      event.languageCode,
      event.confidence ?? null,
      timestamp,
    );
    await db.runAsync(
      'DELETE FROM detection_history WHERE id NOT IN (SELECT id FROM detection_history ORDER BY timestamp DESC LIMIT ?)',
      MAX_HISTORY,
    );
    return this.getRecent();
  },

  async clear(): Promise<void> {
    const db = await databaseService.getDb();
    await db.runAsync('DELETE FROM detection_history');
  },
};
