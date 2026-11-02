# Granite documentation

These files are the source of the [documentation site](https://morrismorrison.github.io/granite/). Each
folder is a section of the site.

| Folder | Section | For |
|---|---|---|
| [`getting-started/`](getting-started/) | Getting started | Everyone new to Granite |
| [`self-hosting/`](self-hosting/) | Self-hosting | People running a Granite server |
| [`project/`](project/) | Project | Roadmap and how to develop Granite |
| [`technical/`](technical/) | Technical docs | Contributors: vision, architecture, data model, sync, API design, mobile app, UI design system |
| [`decisions/`](decisions/) | Repo only | Architecture Decision Records: the reasoning behind each locked choice |
| [`superpowers/`](superpowers/) | Repo only | Design specs and implementation plans |

To add a page, put a Markdown file with a first-level heading in a section folder, then list it in the
sidebar in `apps/docs/astro.config.mjs`.
