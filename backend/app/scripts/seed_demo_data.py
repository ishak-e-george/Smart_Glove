# Run via: python -m app.scripts.seed_demo_data
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.core.database import SessionLocal
from app.repositories.user_repository import user_repository
from app.repositories.gesture_repository import gesture_repository
from app.repositories.phrase_repository import phrase_repository
from app.schemas.user import UserCreate
from app.schemas.gesture import GestureCreate
from app.schemas.phrase import PhraseCreate
from app.core.roles import Role

def seed():
    db = SessionLocal()
    try:
        # 1. Users
        researcher = user_repository.get_by_email(db, email="researcher@glove.com")
        if not researcher:
            user_repository.create(db, obj_in=UserCreate(
                email="researcher@glove.com", password="password123", 
                full_name="Master Researcher", role=Role.RESEARCHER
            ))
        
        user = user_repository.get_by_email(db, email="user@glove.com")
        if not user:
            user_repository.create(db, obj_in=UserCreate(
                email="user@glove.com", password="password123", 
                full_name="Standard User", role=Role.USER
            ))
        
        # 2. Gestures & Phrases
        catalog = [
            ("HELP", "Help Needed", {"en": "I need help", "ar": "أنا بحاجة للمساعدة", "fr": "J'ai besoin d'aide"}),
            ("WATER", "Thirsty", {"en": "I need water", "ar": "أريد ماء", "fr": "Je veux de l'eau"}),
            ("YES", "Yes", {"en": "Yes", "ar": "نعم", "fr": "Oui"}),
            ("NO", "No", {"en": "No", "ar": "لا", "fr": "Non"}),
            ("REST", "Rest", {"en": "", "ar": "", "fr": ""}),
            ("PAIN", "In Pain", {"en": "I am in pain", "ar": "أشعر بالألم", "fr": "J'ai mal"}),
        ]

        for code, name, translations in catalog:
            g = gesture_repository.get_by_code(db, code=code)
            if not g:
                g = gesture_repository.create(db, obj_in=GestureCreate(code=code, display_name=name))
            existing_languages = {
                phrase.language_code
                for phrase in phrase_repository.get_by_gesture(db, gesture_id=g.id)
            }
            for lang, text in translations.items():
                if lang not in existing_languages:
                    phrase_repository.create(db, obj_in=PhraseCreate(
                        gesture_id=g.id, language_code=lang, text_value=text
                    ))
        print("Demo data seeded successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
