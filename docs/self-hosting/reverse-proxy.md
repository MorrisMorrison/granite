# Reverse proxy

A reverse proxy gives Granite HTTPS. You need that to install Granite on your phone, and to keep passwords off the network in plain text.

Whichever proxy you use, set these two values in `.env`, then run `docker compose up -d`:

```sh
GRANITE_BASE_URL=https://granite.example.com
GRANITE_TRUSTED_PROXY=true
```

`GRANITE_TRUSTED_PROXY=true` makes Granite read the client's IP from request headers, which the rate limits rely on.

:::caution[Overwrite the client IP headers]
With `GRANITE_TRUSTED_PROXY=true`, Granite believes the first of these headers it finds: `True-Client-IP`, `X-Real-IP`, `X-Forwarded-For`. Your proxy has to overwrite all three, or a client could send its own values and get around the rate limits. The examples below do this.

Leave the setting `false` if the port is exposed directly, without a proxy.
:::

## Caddy

Caddy gets and renews the HTTPS certificate for you.

```caddy
granite.example.com {
	reverse_proxy localhost:8080 {
		header_up True-Client-IP {remote_host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
	}
}
```

## nginx

This example assumes you already have a certificate, for example from [Certbot](https://certbot.eff.org/).

```nginx
server {
	listen 443 ssl;
	server_name granite.example.com;

	ssl_certificate /etc/letsencrypt/live/granite.example.com/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/granite.example.com/privkey.pem;

	# Imports can be larger than nginx's 1 MB default.
	client_max_body_size 50m;

	location / {
		proxy_pass http://127.0.0.1:8080;
		proxy_set_header Host $host;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header True-Client-IP $remote_addr;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $remote_addr;
	}
}
```

## Other proxies

Traefik and other proxies work too. Forward to port `8080`, and make sure the three headers above can't be set by clients.

## Check it works

Open `https://granite.example.com/healthz`. A successful response means the proxy can reach Granite.
