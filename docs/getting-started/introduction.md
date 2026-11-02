# Introduction

Granite is a workout tracker you run on your own server. You build routines, log your sets at the gym, and follow your progress over time. Your training history stays on hardware you control.

## What you can do with it

- **Log workouts quickly.** See what you lifted last time, tick off sets, and let the rest timer run.
- **Plan with routines.** Group them in folders, and Granite suggests which one is next.
- **Follow your progress.** Personal records, estimated 1RM trends, weekly volume, and sets per muscle.
- **Train without signal.** Everything works offline and syncs when you're back online.
- **Keep your data.** Export it as JSON at any time, or import your history from Hevy.

## How it works

Granite has two parts:

- **The server** is a single container that stores your data in one SQLite file. A Raspberry Pi, a NAS, or a small VPS is plenty.
- **The app** runs in your browser, and you can install it on your phone's home screen. It keeps a full copy of your data on the device, so it stays fast and works offline.

## Project status

Granite is in active development and hasn't reached 1.0 yet, so expect changes between releases. See the [roadmap](../project/roadmap.md) for what's planned.

## Next steps

- [Quick start](quick-start.md): run your own server in a few minutes.
- [Install on your phone](install-on-your-phone.md): add Granite to your home screen.
