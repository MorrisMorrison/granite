# Backups and restore

All your data lives in one folder, so backing it up is simple. Granite doesn't take backups by itself yet, so set up your own schedule. There are two kinds of backup, and it's worth having both.

## Back up the server

This keeps everything on the instance, for every account. The commands assume the default Compose setup and run from the folder with `docker-compose.yml`. Stop Granite first, so the copy is consistent:

```sh
docker compose stop
docker run --rm --volumes-from "$(docker compose ps -aq granite)" -v "$PWD":/backup alpine \
  tar czf "/backup/granite-$(date +%F).tar.gz" -C /data .
docker compose start
```

If you store data in a host folder, you can archive that folder instead.

To back up without stopping Granite, use `sqlite3 granite.db ".backup backup.db"` from a machine with SQLite and access to the data folder. The image doesn't include `sqlite3`. Don't copy the database file while Granite is running: recent changes may still be in a side file, and the copy can be inconsistent.

## Restore the server

```sh
docker compose stop
docker run --rm --volumes-from "$(docker compose ps -aq granite)" -v "$PWD":/backup alpine \
  sh -c 'rm -f /data/granite.db* && tar xzf /backup/granite-2026-11-03.tar.gz -C /data'
docker compose start
```

Replace the file name with your backup. Open devices detect a restored server by themselves and download a fresh copy, but changes they haven't synced yet may not survive that. Open Granite on your main device and check it before you start logging again.

## Export your own data

Any user can download a full JSON copy of their data, with no server access needed. Go to **Settings**, then **Export JSON**. To load it again, use **Import JSON** in the same place. Importing merges by id, so running it twice won't create duplicates.

## Test your backups

A backup you haven't restored is a guess. Every so often, restore one on a separate machine and check that your workouts are there.
