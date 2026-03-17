#!/usr/bin/env bash

set -euo pipefail

BASE_BRANCH="${1:-main}"
SPRINT_TAG="${2:-sprint-current}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(dirname "$ROOT_DIR")"
REPO_NAME="$(basename "$ROOT_DIR")"

agent_track() {
  case "$1" in
    a) echo "backend" ;;
    b) echo "frontend" ;;
    c) echo "infra" ;;
    d) echo "qa" ;;
    *)
      echo "unknown"
      return 1
      ;;
  esac
}

echo "Root: $ROOT_DIR"
echo "Base branch: $BASE_BRANCH"
echo "Sprint tag: $SPRINT_TAG"

cd "$ROOT_DIR"
git fetch origin >/dev/null 2>&1 || true

for AGENT in a b c d; do
  TRACK="$(agent_track "$AGENT")"
  BRANCH="agent/${TRACK}/${SPRINT_TAG}"
  WORKTREE_PATH="${PARENT_DIR}/${REPO_NAME}-agent-${AGENT}"

  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "Branch exists: $BRANCH"
  else
    echo "Creating branch: $BRANCH from $BASE_BRANCH"
    git branch "$BRANCH" "$BASE_BRANCH"
  fi

  if [ -d "$WORKTREE_PATH/.git" ] || [ -f "$WORKTREE_PATH/.git" ]; then
    echo "Worktree already exists: $WORKTREE_PATH"
    continue
  fi

  echo "Adding worktree: $WORKTREE_PATH -> $BRANCH"
  git worktree add "$WORKTREE_PATH" "$BRANCH"
done

echo
echo "Done. Worktrees created:"
echo "  ${PARENT_DIR}/${REPO_NAME}-agent-a"
echo "  ${PARENT_DIR}/${REPO_NAME}-agent-b"
echo "  ${PARENT_DIR}/${REPO_NAME}-agent-c"
echo "  ${PARENT_DIR}/${REPO_NAME}-agent-d"
echo
echo "Next:"
echo "  cp docs/AGENT_EXECUTION_BOARD.md docs/AGENT_EXECUTION_BOARD.active.md"
echo "  Fill the board and start assigning tasks."
