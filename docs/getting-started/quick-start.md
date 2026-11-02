# Quick start

This guide takes you from nothing to a running Granite server on your own machine. You'll need [Docker](https://docs.docker.com/get-started/get-docker/) with Docker Compose.

## 1. Get the files

Create a folder and download the Compose file and the example config:

```sh
mkdir granite && cd granite
curl -fsSLO https://raw.githubusercontent.com/MorrisMorrison/granite/main/deploy/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/MorrisMorrison/granite/main/deploy/.env.example
```

## 2. Set a secret

Generate a signing secret:

```sh
openssl rand -base64 48
```

Open `.env` and paste the result after `GRANITE_JWT_SECRET=`. The other defaults are fine for trying Granite on this machine.

## 3. Start Granite

```sh
docker compose up -d
```

## 4. Create your account

Open <http://localhost:8080> and register. The first account can always be created. After that, registration stays closed unless you turn it on.

That's it. You can start logging workouts.

## Next steps

To use Granite from your phone at the gym, the server has to be reachable from outside this machine, ideally over HTTPS.

- [Self-hosting](../self-hosting/install.md): the full setup, reverse proxy, and backups.
- [Install on your phone](install-on-your-phone.md): add Granite to your home screen.
