# Upgrading

## Upgrade to a new version

1. Read the [release notes](https://github.com/MorrisMorrison/granite/releases). Granite hasn't reached 1.0 yet, so changes between releases are possible.
2. [Back up the server](backups.md).
3. If you pin a version, change the image tag in `docker-compose.yml`.
4. Pull the new image and restart:

   ```sh
   docker compose pull
   docker compose up -d
   ```

Database changes run automatically when the new version starts. Check the result with `docker compose ps` and `docker compose logs granite`.

Installed apps pick up the new version by themselves the next time they load.

## Go back to an older version

Database changes aren't undone automatically, so an older version may not work with a newer database. To go back:

1. Change the image tag back to the older version.
2. [Restore the backup](backups.md#restore-the-server) you took before upgrading.

Anything logged after that backup is lost on the server. Export your data first if you want to keep it, using **Settings**, then **Export JSON**.
