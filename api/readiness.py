"""Read-only dependency checks, invoked explicitly rather than during startup."""

import json
import logging

import boto3
import psycopg
from botocore.config import Config

from api.config import Settings

logger = logging.getLogger(__name__)
AWS_TIMEOUTS = Config(
    connect_timeout=2, read_timeout=3, retries={"total_max_attempts": 1}
)


def check_dependencies(settings: Settings) -> dict[str, str]:
    if settings.environment not in {"cloud", "production"}:
        return {}

    checks = {"database": "unavailable", "s3": "unavailable"}
    try:
        session = boto3.Session(
            profile_name=settings.aws_profile, region_name=settings.aws_region
        )
    except Exception as error:
        # SDK exceptions can contain credentials and request parameters.
        logger.warning("AWS session unavailable (%s)", type(error).__name__)
        return checks

    try:
        parameters = {
            "connect_timeout": 4,
            "options": "-c default_transaction_read_only=on -c statement_timeout=2000",
            "sslmode": "verify-full",
        }
        if settings.db_sslrootcert:
            parameters["sslrootcert"] = str(settings.db_sslrootcert)
        if settings.database_url:
            connection = psycopg.connect(
                settings.database_url.get_secret_value(), **parameters
            )
        else:
            if not all(
                (
                    settings.db_host,
                    settings.db_name,
                    settings.db_secret_id,
                    settings.db_sslrootcert,
                )
            ):
                raise ValueError("Database configuration incomplete")
            # Fetch AWSCURRENT for every explicit readiness probe, including after
            # a password rotation. Never persist the returned value to disk/logs.
            secret = session.client("secretsmanager", config=AWS_TIMEOUTS)
            credentials = json.loads(
                secret.get_secret_value(SecretId=settings.db_secret_id)["SecretString"]
            )
            connection = psycopg.connect(
                host=settings.db_host,
                port=settings.db_port,
                dbname=settings.db_name,
                user=credentials["username"],
                password=credentials["password"],
                **parameters,
            )
        with connection:
            if connection.execute("SELECT 1").fetchone() != (1,):
                raise ValueError("Unexpected database response")
        checks["database"] = "ok"
    except Exception as error:
        logger.warning("Database readiness failed (%s)", type(error).__name__)

    try:
        if not settings.s3_bucket:
            raise ValueError("S3 bucket missing")
        session.client("s3", config=AWS_TIMEOUTS).head_bucket(Bucket=settings.s3_bucket)
        checks["s3"] = "ok"
    except Exception as error:
        logger.warning("S3 readiness failed (%s)", type(error).__name__)
    return checks
