import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    sys.platform == "win32", reason="EC2 deployment tests require Linux Bash/flock"
)
INFRA = Path(__file__).resolve().parents[2] / "infra"
OLD_IMAGE = "ghcr.io/example/riverbank-api:" + "a" * 40
NEW_IMAGE = "ghcr.io/example/riverbank-api:" + "b" * 40

STUB = r"""#!/usr/bin/python3
import json, os, pathlib, sys
args = sys.argv[1:]
tool = pathlib.Path(sys.argv[0]).name
state = pathlib.Path(os.environ["DEPLOY_STATE"])
with open(os.environ["DEPLOY_TRACE"], "a") as trace:
    trace.write(json.dumps([tool, os.environ.get("API_IMAGE"), args]) + "\n")
mode = os.environ.get("DEPLOY_FAILURE", "")
if tool == "sleep":
    sys.exit(0)
if tool == "curl":
    if mode == "health" and state.read_text() == os.environ["NEW_IMAGE"]:
        sys.exit(22)
    print('{"status":"ok"}')
elif args[:2] == ["image", "inspect"]:
    if "--format" in args:
        print("arm64")
elif args[0] == "inspect":
    print(state.read_text())
elif args[0] == "compose":
    if "config" in args and mode == "config":
        sys.exit(1)
    if "up" in args:
        state.write_text(os.environ["API_IMAGE"])
        if mode == "up" and os.environ["API_IMAGE"] == os.environ["NEW_IMAGE"]:
            sys.exit(1)
    if "ps" in args:
        print("container-id")
    if "down" in args:
        state.unlink(missing_ok=True)
"""


@pytest.fixture
def deployment(tmp_path, monkeypatch):
    root = tmp_path / "app"
    release = root / "releases" / ("b" * 40)
    previous = root / "releases" / ("a" * 40)
    for directory in (release, previous):
        directory.mkdir(parents=True)
        for source in INFRA.iterdir():
            shutil.copy2(source, directory / source.name)
    (root / ".env").write_text("SITE_ADDRESS=api.example.test\n")
    (previous / "image").write_text(OLD_IMAGE)
    (root / "current").symlink_to(previous, target_is_directory=True)
    state = tmp_path / "running-image"
    state.write_text(OLD_IMAGE)
    trace = tmp_path / "trace"
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name in ("docker", "curl", "sleep"):
        command = bin_dir / name
        command.write_text(STUB)
        command.chmod(0o755)
    monkeypatch.setenv("PATH", str(bin_dir) + os.pathsep + os.environ["PATH"])
    monkeypatch.setenv("DEPLOY_STATE", str(state))
    monkeypatch.setenv("DEPLOY_TRACE", str(trace))
    monkeypatch.setenv("NEW_IMAGE", NEW_IMAGE)

    def run(image=NEW_IMAGE):
        return subprocess.run(
            [
                "bash",
                str(release / "deploy.sh"),
                image,
                "https://api.example.test/health",
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )

    return root, release, previous, state, trace, run


def test_success_promotes_release_and_retains_previous(deployment):
    root, release, previous, state, _, run = deployment
    result = run()

    assert result.returncode == 0, result.stderr
    assert state.read_text() == NEW_IMAGE
    assert (root / "current").resolve() == release
    assert (root / "previous").resolve() == previous


@pytest.mark.parametrize("failure", ["up", "health"])
def test_failure_restores_previous_image_and_configuration(
    deployment, monkeypatch, failure
):
    root, _, previous, state, trace, run = deployment
    monkeypatch.setenv("DEPLOY_FAILURE", failure)
    result = run()

    assert result.returncode != 0
    assert "Rollback passed" in result.stderr
    assert state.read_text() == OLD_IMAGE
    assert (root / "current").resolve() == previous
    calls = [json.loads(line) for line in trace.read_text().splitlines()]
    rollback_calls = [call for call in calls if call[1] == OLD_IMAGE]
    assert any(str(previous / "compose.yaml") in call[2] for call in rollback_calls)


def test_first_deploy_failure_stops_stack_without_removing_volumes(
    deployment, monkeypatch
):
    root, _, _, state, trace, run = deployment
    (root / "current").unlink()
    monkeypatch.setenv("DEPLOY_FAILURE", "health")
    result = run()

    assert result.returncode != 0
    assert not state.exists()
    assert not (root / "current").exists()
    calls = [json.loads(line) for line in trace.read_text().splitlines()]
    assert any("down" in call[2] for call in calls)
    assert all("--volumes" not in call[2] for call in calls)


@pytest.mark.parametrize("failure", ["config", "domain", "tag"])
def test_invalid_deployment_does_not_change_running_stack(
    deployment, monkeypatch, failure
):
    root, _, previous, state, trace, run = deployment
    if failure == "domain":
        (root / ".env").write_text("SITE_ADDRESS=different.example.test\n")
    monkeypatch.setenv("DEPLOY_FAILURE", failure)
    result = run(
        "ghcr.io/example/riverbank-api:latest" if failure == "tag" else NEW_IMAGE
    )

    assert result.returncode != 0
    assert state.read_text() == OLD_IMAGE
    assert (root / "current").resolve() == previous
    calls = (
        [json.loads(line) for line in trace.read_text().splitlines()]
        if trace.exists()
        else []
    )
    assert all("up" not in call[2] and "down" not in call[2] for call in calls)
