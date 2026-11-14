# Security

## Reporting a problem

Please open a private security advisory on this repository (Security → Advisories → Report a vulnerability) rather than a public issue. Include the app version (shown in Android's app info) and the steps to reproduce.

## What the app can and cannot do

KingShot Assistant has no account system and no backend of its own. Everything you enter stays on the device.

| Data | Where it lives |
|---|---|
| Language, accent colour | Local storage of the app |
| Rally leaders and march times | Local storage of the app |
| Auto clicker macros | The app's private preferences |

Backups and device-to-device transfer of this data are disabled.

### Network

The Android app makes one kind of request: reading the current time from a public time source (Cloudflare, with a fallback) to synchronise the rally clock. Nothing about you or your game is sent. The web version asks its own server for the time instead and, when hosted on Vercel, loads Vercel's page analytics.

### Android permissions

| Permission | Why |
|---|---|
| Internet | Clock synchronisation |
| Display over other apps | The Rally Timer countdown bubble |
| Foreground service, notifications | Keeps the countdown alive while you are in the game; fallback when the bubble is not allowed |
| Vibrate | Countdown alerts |
| Accessibility service (enabled by hand) | The Auto Clicker's taps |

### The accessibility service

Android only lets an app tap inside another app through an accessibility service, which is a powerful permission, so this one is deliberately narrow:

- It declares **no event types** and `canRetrieveWindowContent="false"`: it receives nothing about what is on screen and cannot read other apps' content.
- It only performs gestures at the points you placed with the on-screen markers.
- Every value of a macro is clamped when loaded (interval, repeat counts, coordinates), so corrupted data cannot produce a runaway loop.
- It stops when the screen turns off, when the device rotates, after repeated failed gestures, and from its always-visible stop button.
- Only the Android system can bind to it.

You can turn it off at any time in Android's accessibility settings.

## Build and release

- Signing keys are never committed. Release APKs are signed in CI from repository secrets.
- Release builds are shrunk and obfuscated with R8.
- Dependencies are audited on every push (`pnpm audit`), and the build fails on type errors.
- Install the app only from this repository's Releases page. An APK from anywhere else is not from this project.

Betas published before 1.2.0 were signed with a development key that used to be stored in this repository. That key is retired: uninstall those versions before installing a current one.
