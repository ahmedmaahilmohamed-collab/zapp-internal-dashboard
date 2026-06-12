import time
from dataclasses import dataclass
from typing import Any, Literal

import httpx


DiagnosticStatus = Literal[
    "success",
    "unauthorized",
    "forbidden",
    "not_found",
    "timeout",
    "server_error",
    "invalid_response",
    "unknown_error",
]


@dataclass(frozen=True)
class DiagnosticTarget:
    label: str
    path: str
    collection_keys: tuple[str, ...]


class ZappApiError(Exception):
    def __init__(
        self,
        *,
        status: DiagnosticStatus,
        message: str,
        upstream_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.upstream_status = upstream_status


DIAGNOSTIC_TARGETS: tuple[DiagnosticTarget, ...] = (
    DiagnosticTarget("Orders", "/api/internal/orders", ("items", "orders")),
    DiagnosticTarget(
        "Purchase Requests",
        "/api/internal/purchase-requests",
        ("items", "requests"),
    ),
    DiagnosticTarget("Email Logs", "/api/internal/email-logs", ("items", "logs")),
)


class ZappApiClient:
    def __init__(
        self,
        *,
        base_url: str | None,
        token: str | None,
        timeout_seconds: float,
    ) -> None:
        self.base_url = (base_url or "").rstrip("/")
        self._token = token or ""
        self.timeout_seconds = timeout_seconds

    @property
    def is_configured(self) -> bool:
        return bool(
            self.base_url
            and self._token
            and not self._looks_placeholder(self.base_url)
            and not self._looks_placeholder(self._token)
        )

    async def run_diagnostics(self) -> list[dict[str, Any]]:
        return [await self.check_target(target) for target in DIAGNOSTIC_TARGETS]

    async def fetch_collection(
        self,
        *,
        path: str,
        collection_keys: tuple[str, ...],
        params: dict[str, Any] | None = None,
    ) -> tuple[list[Any], dict[str, Any]]:
        payload, meta = await self.fetch_json(path=path, params=params)
        items = self._extract_collection(payload, collection_keys)
        total = self._extract_total(payload, len(items))

        return items, {
            **meta,
            "total": total,
            "responseKeys": list(payload.keys()) if isinstance(payload, dict) else [],
        }

    async def fetch_json(
        self,
        *,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> tuple[Any, dict[str, Any]]:
        if not self.is_configured:
            raise ZappApiError(
                status="unknown_error",
                message="ZAPP API base URL or token is not configured.",
            )

        url = f"{self.base_url}{path}"
        started = time.perf_counter()

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    url,
                    headers={
                        "Authorization": f"Bearer {self._token}",
                        "Accept": "application/json",
                    },
                    params=self._clean_params(params or {}),
                )
        except httpx.TimeoutException as exc:
            raise ZappApiError(
                status="timeout",
                message="The ZAPP API request timed out.",
            ) from exc
        except httpx.HTTPError as exc:
            raise ZappApiError(
                status="unknown_error",
                message="The ZAPP API request failed before receiving a response.",
            ) from exc

        elapsed_ms = self._elapsed_ms(started)
        status = self._classify_status_code(response.status_code)

        if status != "success":
            raise ZappApiError(
                status=status,
                message=self._message_for_status(status),
                upstream_status=response.status_code,
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise ZappApiError(
                status="invalid_response",
                message="The ZAPP API returned non-JSON content.",
                upstream_status=response.status_code,
            ) from exc

        if not isinstance(payload, (dict, list)):
            raise ZappApiError(
                status="invalid_response",
                message="The ZAPP API returned an unsupported JSON shape.",
                upstream_status=response.status_code,
            )

        if isinstance(payload, dict) and payload.get("success") is False:
            raise ZappApiError(
                status="unknown_error",
                message=self._safe_message(payload),
                upstream_status=response.status_code,
            )

        return payload, {
            "upstreamStatus": response.status_code,
            "elapsedMs": elapsed_ms,
        }

    async def check_target(self, target: DiagnosticTarget) -> dict[str, Any]:
        if not self.is_configured:
            return self._base_result(
                target,
                status="unknown_error",
                message="ZAPP API base URL or token is not configured.",
            )

        url = f"{self.base_url}{target.path}"
        started = time.perf_counter()

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    url,
                    headers={
                        "Authorization": f"Bearer {self._token}",
                        "Accept": "application/json",
                    },
                    params={"limit": 1, "skip": 0},
                )
        except httpx.TimeoutException:
            return self._base_result(
                target,
                status="timeout",
                elapsed_ms=self._elapsed_ms(started),
                message="The ZAPP API request timed out.",
            )
        except httpx.HTTPError:
            return self._base_result(
                target,
                status="unknown_error",
                elapsed_ms=self._elapsed_ms(started),
                message="The ZAPP API request failed before receiving a response.",
            )

        elapsed_ms = self._elapsed_ms(started)
        status = self._classify_status_code(response.status_code)
        base = self._base_result(
            target,
            status=status,
            upstream_status=response.status_code,
            elapsed_ms=elapsed_ms,
        )

        if status != "success":
            return base

        try:
            payload = response.json()
        except ValueError:
            return {
                **base,
                "status": "invalid_response",
                "message": "The ZAPP API returned non-JSON content.",
            }

        response_keys = list(payload.keys()) if isinstance(payload, dict) else []
        item_count = self._extract_item_count(payload, target.collection_keys)

        if isinstance(payload, dict) and payload.get("success") is False:
            return {
                **base,
                "status": "unknown_error",
                "responseKeys": response_keys,
                "itemCount": item_count,
                "message": self._safe_message(payload),
            }

        if not isinstance(payload, (dict, list)):
            return {
                **base,
                "status": "invalid_response",
                "message": "The ZAPP API returned an unsupported JSON shape.",
            }

        return {
            **base,
            "responseKeys": response_keys,
            "itemCount": item_count,
        }

    def _base_result(
        self,
        target: DiagnosticTarget,
        *,
        status: DiagnosticStatus,
        upstream_status: int | None = None,
        elapsed_ms: int | None = None,
        message: str | None = None,
    ) -> dict[str, Any]:
        result: dict[str, Any] = {
            "label": target.label,
            "path": target.path,
            "status": status,
            "upstreamStatus": upstream_status,
            "elapsedMs": elapsed_ms,
            "itemCount": None,
            "responseKeys": [],
        }

        if message:
            result["message"] = message

        return result

    def _elapsed_ms(self, started: float) -> int:
        return round((time.perf_counter() - started) * 1000)

    def _classify_status_code(self, status_code: int) -> DiagnosticStatus:
        if 200 <= status_code < 300:
            return "success"
        if status_code == 401:
            return "unauthorized"
        if status_code == 403:
            return "forbidden"
        if status_code == 404:
            return "not_found"
        if 500 <= status_code <= 599:
            return "server_error"
        return "unknown_error"

    def _extract_item_count(
        self,
        payload: Any,
        collection_keys: tuple[str, ...],
    ) -> int | None:
        if isinstance(payload, list):
            return len(payload)

        if not isinstance(payload, dict):
            return None

        for key in collection_keys:
            value = payload.get(key)
            if isinstance(value, list):
                return len(value)

        total = payload.get("total")
        if isinstance(total, int):
            return total

        return None

    def _extract_collection(
        self,
        payload: Any,
        collection_keys: tuple[str, ...],
    ) -> list[Any]:
        if isinstance(payload, list):
            return payload

        if not isinstance(payload, dict):
            return []

        for key in collection_keys:
            value = payload.get(key)
            if isinstance(value, list):
                return value

        return []

    def _extract_total(self, payload: Any, fallback: int) -> int:
        if isinstance(payload, dict):
            total = payload.get("total")
            if isinstance(total, int):
                return total
            if isinstance(total, str) and total.isdigit():
                return int(total)

        return fallback

    def _clean_params(self, params: dict[str, Any]) -> dict[str, Any]:
        return {
            key: value
            for key, value in params.items()
            if value is not None and value != ""
        }

    def _looks_placeholder(self, value: str) -> bool:
        normalized = value.strip().lower()
        return (
            not normalized
            or "replace" in normalized
            or "your-secure" in normalized
            or normalized in {"...", "todo", "changeme"}
        )

    def _message_for_status(self, status: DiagnosticStatus) -> str:
        messages: dict[DiagnosticStatus, str] = {
            "success": "The ZAPP API request succeeded.",
            "unauthorized": "ZAPP API credentials were rejected.",
            "forbidden": "ZAPP API access is forbidden for this token.",
            "not_found": "The requested ZAPP API endpoint was not found.",
            "timeout": "The ZAPP API request timed out.",
            "server_error": "The ZAPP API returned a server error.",
            "invalid_response": "The ZAPP API returned an invalid response.",
            "unknown_error": "The ZAPP API request failed.",
        }
        return messages[status]

    def _safe_message(self, payload: dict[str, Any]) -> str:
        message = payload.get("message") or payload.get("error") or "ZAPP API reported an error."
        return str(message)[:240]
