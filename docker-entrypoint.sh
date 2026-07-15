#!/bin/sh
# Granite container entrypoint.
#
# The app runs as the non-root `granite` user. A bind-mounted host directory
# (e.g. `-v /opt/granite/data:/data`) is typically root-owned, so the app can't
# create/write granite.db and SQLite fails with "attempt to write a readonly
# database". To make a plain `mkdir` + bind mount just work, we start as root
# only long enough to make the data dir writable, then drop back to `granite`.
#
# Idempotent: a no-op when the dir is already owned correctly. And when the
# container is already run as non-root (`docker run --user`, or a runAsNonRoot
# platform) we can't chown, so we just exec the app as the given user.
set -e

DATA_DIR="$(dirname "${GRANITE_DB_PATH:-/data/granite.db}")"

# Already non-root → we can't (and needn't) chown; run the app as-is.
if [ "$(id -u)" != "0" ]; then
	exec "$@"
fi

mkdir -p "$DATA_DIR"
# Best-effort: on the odd filesystem where chown isn't permitted, don't block
# startup — if the dir is genuinely unwritable the app will surface it clearly.
chown -R granite:granite "$DATA_DIR" 2>/dev/null \
	|| echo "granite: warning: could not chown $DATA_DIR (continuing)" >&2

# Drop privileges and hand off as PID 1 (su-exec exec's, it doesn't fork).
exec su-exec granite "$@"
