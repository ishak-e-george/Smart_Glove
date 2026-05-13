# Smart Glove API

FastAPI backend for the Smart Glove Project.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure environment:
   The application uses SQLite by default for development (`smart_glove.db`).
   To use PostgreSQL, edit the `DATABASE_URL` in the `.env` file.

3. Run migrations:
   ```bash
   alembic upgrade head
   ```

4. Run the application:
   ```bash
   uvicorn app.main:app --reload
   ```

## API Documentation

Once the app is running, visit:
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
