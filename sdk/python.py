"""Dependency-free Visora server client. Call from a worker, not a critical request transaction."""
import json
import time
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import HTTPRedirectHandler, Request, build_opener


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def send_events(url, key, events, attempts=3, timeout=5):
    if not isinstance(attempts, int) or not 1 <= attempts <= 5:
        raise ValueError("attempts must be 1–5")
    if not key or timeout <= 0:
        raise ValueError("A server key and a positive timeout are required")
    records = [dict(event, eventId=event.get("eventId") or str(uuid.uuid4())) for event in events]
    total = {"accepted": 0, "duplicates": 0}
    opener = build_opener(_NoRedirect())
    for offset in range(0, len(records), 100):
        body = json.dumps({"events": records[offset:offset + 100]}).encode()
        for attempt in range(attempts):
            request = Request(urljoin(url, "/api/ingest"), data=body, headers={
                "Authorization": "Bearer " + key, "Content-Type": "application/json",
            }, method="POST")
            delay = 0.25 * 2 ** attempt
            try:
                with opener.open(request, timeout=timeout) as response:
                    result = json.load(response)
                    total["accepted"] += result["accepted"]
                    total["duplicates"] += result["duplicates"]
                    break
            except HTTPError as error:
                if (error.code != 429 and error.code < 500) or attempt == attempts - 1:
                    raise
                retry_after = error.headers.get("Retry-After", "")
                if retry_after.isdigit():
                    delay = min(60, int(retry_after))
            except (URLError, TimeoutError):
                if attempt == attempts - 1:
                    raise
            time.sleep(delay)
    return total
