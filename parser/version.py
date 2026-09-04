"""Versioned provenance for independently computed combat analytics."""

from datetime import datetime, timezone


PARSER_VERSION = "1.1.1"
METRIC_SCHEMA_VERSION = 1
ANALYTICS_PROFILE = "canonical-v1"


def make_parser_provenance() -> dict[str, str | None]:
    return {
        "parserVersion": PARSER_VERSION,
        "metricSchemaVersion": str(METRIC_SCHEMA_VERSION),
        "compatibilityProfile": ANALYTICS_PROFILE,
        # An inspected reference revision is not evidence of output parity.
        "referenceSha": None,
        "parsedAt": datetime.now(timezone.utc).isoformat(),
    }
