from __future__ import annotations

import argparse
import sys


def speak_text(text: str) -> None:
    try:
        import pyttsx3
    except ImportError as exc:
        raise RuntimeError("pyttsx3 is not installed. Run: pip install pyttsx3") from exc

    engine = pyttsx3.init()
    engine.say(text)
    engine.runAndWait()


def main() -> int:
    parser = argparse.ArgumentParser(description="Speak a line of text with local TTS.")
    parser.add_argument("text", help="Text to speak")
    args = parser.parse_args()

    speak_text(args.text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
