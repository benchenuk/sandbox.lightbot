"""Tests for the FastAPI server."""

import pytest
from fastapi.testclient import TestClient

from server import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_settings_get(client):
    response = client.get("/settings")
    assert response.status_code == 200


def test_chat_clear(client):
    response = client.post("/chat/clear?session_id=test")
    assert response.status_code == 200
    assert response.json()["status"] == "cleared"
