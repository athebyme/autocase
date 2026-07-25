"""Точка входа для serverless-платформ (Vercel и подобных).

Runtime ищет в модуле ASGI-приложение с именем `app` — просто отдаём ему
то же самое приложение, что поднимает uvicorn локально и в Docker.
"""

from app.main import app

__all__ = ["app"]
