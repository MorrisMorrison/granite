# Troubleshooting

Start with the logs. They usually name the problem:

```sh
docker compose ps
docker compose logs granite
```

## The container won't start

**`GRANITE_JWT_SECRET is required`, or `must be at least 32 bytes`.** The secret in `.env` is missing or too short. Generate one with `openssl rand -base64 48`.

**A database or "read-only" error.** Granite can't write to its data folder. The image fixes ownership when it starts, but it can't do that if you run the container with a custom `user:`. Make the folder writable for that user.

## I can't create an account

**`registration is disabled`.** An account already exists and registration is closed. Set `GRANITE_ALLOW_REGISTRATION=true` in `.env`, run `docker compose up -d`, and turn it off again afterwards.

## "Too many requests" when signing in

Granite allows 30 login attempts per minute from one IP address. Behind a reverse proxy, every visitor looks like the same address unless `GRANITE_TRUSTED_PROXY=true` is set. See [Reverse proxy](reverse-proxy.md).

## I can't install Granite on my phone

Your address probably isn't HTTPS, because browsers only offer installation on a secure address. If it is, check that you're in Safari or Chrome rather than an app's built-in browser. See [Install on your phone](../getting-started/install-on-your-phone.md).

## My data is missing or out of date on one device

Check that the device is online, then reload the app. If that doesn't help, go to **Settings** and choose **Reset local data**. This clears the device's copy and downloads everything from the server. Changes that haven't synced yet are lost, so use it after you've checked the server has your data.

## Still stuck?

[Open an issue](https://github.com/MorrisMorrison/granite/issues) with your Granite version (shown in **Settings**), how you run it, and the relevant log lines. Remove any secrets first.
