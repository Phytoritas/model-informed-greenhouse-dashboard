from datetime import UTC, datetime

import pytest

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.conversation_store import (
    ConversationStore,
    ConversationThreadConflict,
)


NOW = datetime(2026, 8, 16, 1, 0, tzinfo=UTC)


def test_conversation_store_round_trips_and_is_idempotent(tmp_path):
    store = ConversationStore(tmp_path / "conversation.sqlite3")
    thread_id = store.ensure_thread(
        None,
        crop="tomato",
        greenhouse_id="house-1",
        now=NOW,
    )
    first = store.append_exchange(
        thread_id=thread_id,
        run_id="run-0001",
        user_text="야간 온도를 낮추면?",
        assistant_text="모델 범위 안에서 검토합니다.",
        created_at=NOW,
    )
    second = store.append_exchange(
        thread_id=thread_id,
        run_id="run-0001",
        user_text="야간 온도를 낮추면?",
        assistant_text="모델 범위 안에서 검토합니다.",
        created_at=NOW,
    )
    assert first["inserted_turns"] == 2
    assert second["inserted_turns"] == 0
    assert store.history(thread_id) == [
        {"role": "user", "content": "야간 온도를 낮추면?"},
        {"role": "assistant", "content": "모델 범위 안에서 검토합니다."},
    ]


def test_thread_id_cannot_cross_greenhouse_boundary(tmp_path):
    store = ConversationStore(tmp_path / "conversation.sqlite3")
    thread_id = store.ensure_thread(
        "thread-12345678",
        crop="tomato",
        greenhouse_id="house-1",
        now=NOW,
    )
    with pytest.raises(ConversationThreadConflict):
        store.ensure_thread(
            thread_id,
            crop="tomato",
            greenhouse_id="house-2",
            now=NOW,
        )
