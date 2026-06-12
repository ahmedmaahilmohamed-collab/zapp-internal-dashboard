import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status


_buckets: dict[str, deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()[:64]
    if request.client:
        return request.client.host
    return "unknown"


def rate_limit(*, name: str, max_requests: int, window_seconds: int) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        now = time.monotonic()
        key = f"{name}:{client_ip(request)}"
        bucket = _buckets[key]

        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()

        if len(bucket) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )

        bucket.append(now)

    return dependency
