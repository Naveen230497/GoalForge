# Use the official Python slim image — small and fast
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies first (Docker layer caching)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Use gunicorn for production
CMD exec gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 120 backend.app:app
