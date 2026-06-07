from __future__ import annotations

GESTURE_PHRASES: dict[str, str] = {
    "OPEN": "Hello",
    "INDEX_BENT": "Yes",
    "MIDDLE_BENT": "No",
    "RING_BENT": "Help",
    "PINKY_BENT": "Thank you",
    "THUMB_BENT": "I am okay",
    "FIST": "I need assistance",
}


def phrase_for_gesture(gesture: str) -> str:
    return GESTURE_PHRASES.get(gesture.upper(), gesture)
