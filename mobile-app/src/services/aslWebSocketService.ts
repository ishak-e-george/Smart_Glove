import { GestureLabel, GestureMessage } from '../types/gesture';
import { ASL_ALPHABET_LABELS, WORD_GESTURE_LABELS } from '../constants/defaultProfiles';

const VALID_LABELS: GestureLabel[] = [...WORD_GESTURE_LABELS, ...ASL_ALPHABET_LABELS];

function toGestureLabel(value: string): GestureLabel | null {
  const normalized = value.trim().toUpperCase();
  return VALID_LABELS.includes(normalized as GestureLabel) ? normalized as GestureLabel : null;
}

export function parseGestureMessage(raw: string): GestureMessage | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as GestureMessage;
    if (parsed.type === 'gesture_detected' || parsed.type === 'system_state') {
      const label = parsed.label ? toGestureLabel(String(parsed.label)) : undefined;
      const leftLabel = parsed.leftLabel ? toGestureLabel(String(parsed.leftLabel)) ?? String(parsed.leftLabel) : undefined;
      const rightLabel = parsed.rightLabel ? toGestureLabel(String(parsed.rightLabel)) ?? String(parsed.rightLabel) : undefined;
      return {
        ...parsed,
        label: label ?? parsed.label,
        leftLabel,
        rightLabel,
        raw,
      };
    }
  } catch {
    // Fall through to legacy pipe parser.
  }

  const parts = trimmed.split('|');
  if (parts.length < 3) return null;

  const label = toGestureLabel(parts[0]);
  if (!label) return null;

  const confidence = Number.parseFloat(parts[2]);
  const fingers = (parts[3] ?? '')
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));

  return {
    type: label === 'REST' ? 'system_state' : 'gesture_detected',
    label,
    confidence: Number.isFinite(confidence) ? confidence : undefined,
    state: label === 'REST' ? 'READY' : 'WAITING_FOR_REST',
    fingers,
    raw,
  };
}
