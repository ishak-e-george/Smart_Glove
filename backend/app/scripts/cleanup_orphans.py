import argparse
import sys
import os

# Add the parent directory to sys.path to allow importing 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.core.database import SessionLocal
from app.services.recording_service import recording_service

def main():
    parser = argparse.ArgumentParser(description="Cleanup orphaned recording files.")
    parser.add_argument(
        "--apply", 
        action="store_true", 
        help="Actually delete the orphaned files. If not set, will perform a dry run."
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        print(f"Scanning for orphaned recordings (dry_run={'False' if args.apply else 'True'})...")
        orphans = recording_service.cleanup_orphaned_recordings(db, dry_run=not args.apply)
        
        if not orphans:
            print("No orphaned files found.")
        else:
            print(f"Found {len(orphans)} orphaned files:")
            for o in orphans:
                print(f"  - {o}")
            
            if args.apply:
                print(f"\nSuccessfully deleted {len(orphans)} orphaned files.")
            else:
                print(f"\nDry run complete. Run with --apply to actually delete these files.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
