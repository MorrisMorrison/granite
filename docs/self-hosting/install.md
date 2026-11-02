# Install

Granite runs as a single container that serves both the app and the API, and stores everything in one SQLite file. There's no separate database to run. This page covers a setup you can reach from your phone. To try Granite on your own machine first, see the [quick start](../getting-started/quick-start.md).

## What you need

- A machine that stays on, with Docker and Docker Compose. A Raspberry Pi, a NAS, or a small VPS is plenty.
- A domain name pointing at that machine, for HTTPS. Browsers only let you install Granite on your phone from a secure address.

Images are published for `linux/amd64` and `linux/arm64`.

## Set up the server

1. Create a folder and download the Compose file and the example config:

   ```sh
   mkdir granite && cd granite
   curl -fsSLO https://raw.githubusercontent.com/MorrisMorrison/granite/main/deploy/docker-compose.yml
   curl -fsSL -o .env https://raw.githubusercontent.com/MorrisMorrison/granite/main/deploy/.env.example
   ```

2. Generate a signing secret:

   ```sh
   openssl rand -base64 48
   ```

3. Edit `.env`. Paste the secret after `GRANITE_JWT_SECRET=`, and set `GRANITE_BASE_URL` to the address you'll use:

   ```sh
   GRANITE_JWT_SECRET=your-generated-secret
   GRANITE_BASE_URL=https://granite.example.com
   ```

4. Start Granite:

   ```sh
   docker compose up -d
   ```

5. Put it behind a [reverse proxy](reverse-proxy.md) for HTTPS, then open your address and register. The first account can always be created. After that, registration stays closed unless you [turn it on](configuration.md#accounts).

## Choose an image tag

The Compose file uses `:latest`, which follows the `main` branch and changes with every merged update. To stay on a release, pin its version:

```yaml
image: ghcr.io/morrismorrison/granite:0.0.1
```

See the [releases](https://github.com/MorrisMorrison/granite/releases) for what's available. Granite hasn't reached 1.0 yet: releases are snapshots on the way there, not long-term-supported versions.

## Store data in a host folder

The Compose file keeps your data in a named Docker volume. To use a folder on the host instead, replace the volume in `docker-compose.yml`:

```yaml
volumes:
  - /opt/granite/data:/data
```

Create the folder with `sudo mkdir -p /opt/granite/data`. The container fixes the folder's ownership when it starts, so you don't need to `chown` it yourself.

## Build from source

To build the image yourself, clone the repository and replace the `image:` line in `deploy/docker-compose.yml` with `build: ..`. See [Development](../project/development.md) for working on Granite locally.

## Next steps

- [Configuration](configuration.md): every setting.
- [Backups and restore](backups.md): do this before you log your first real workout.
- [Upgrading](upgrading.md): moving to a new version.
