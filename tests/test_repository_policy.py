from pathlib import Path


def test_gitignore_excludes_docs_and_screenshot_artifacts() -> None:
    patterns = {
        line.strip()
        for line in Path(".gitignore").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    }

    assert "docs/" in patterns
    assert "screenshots/" in patterns
    assert "*.screenshot.png" in patterns
    assert "*.screenshot.jpg" in patterns
    assert "*.screenshot.jpeg" in patterns
