"""Start Uvicorn with the central application settings."""

import uvicorn

from api.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "api.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )


if __name__ == "__main__":
    main()
