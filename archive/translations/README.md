# Archived translations

The app ships in **English** (default) and **French** only. The other six
languages were archived here so they are not lost, and are not compiled.

Languages: German (`de`), Spanish (`es`), Portuguese (`pt`), Italian (`it`),
Turkish (`tr`), Russian (`ru`).

For each language there are three files, taken from the app as of
1.2.0-beta.6-test2:

| File | Was |
|---|---|
| `<lang>.app.ts.txt` | `lib/locales/<lang>.ts`: texts of the home screen, settings and modules |
| `<lang>.rally-ui.ts.txt` | the `<lang>` block of `UI` in `lib/i18n.ts`: Rally Timer texts |
| `<lang>.rally-messages.ts.txt` | the `<lang>` block of `MESSAGES` in `lib/messages.ts`: messages copied into alliance chat |

They are plain text on purpose (`.txt`), so TypeScript and the bundler ignore them.

## Bringing a language back

These files are **out of date**: they have none of the texts added after that
version (Text Art, the Frakinator note, the reorder feature, ...). To restore one:

1. Copy the files back to their place, dropping the `.txt` and the `<lang>.` prefix parts as needed.
2. Add the language to `LANGS`, `LANG_NAMES` (`lib/messages.ts`), `APP_TEXT` and `LOCALE_TAG` (`lib/locales/index.ts`).
3. Run `pnpm typecheck`: the compiler lists every missing key.
