# API tokens

Personal API tokens let your own scripts and tools use your Granite data through the [REST API](/granite/api/). Your own instance also serves an interactive reference at `/docs`.

## Create a token

1. Go to **Settings**, then **API tokens**, and tap **New**.
2. Give the token a name.
3. Turn on write access only if it needs to log workouts or edit routines. Tokens are read-only by default.
4. Copy the token. You'll only see it once.

## Use a token

Send it as a bearer token:

```sh
curl -H "Authorization: Bearer gra_your_token" https://granite.example.com/api/v1/workouts
```

## Revoke a token

In **Settings**, use the trash icon next to the token. Anything using it stops working right away.
