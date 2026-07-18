# Contributing

Thanks for your interest in PuruPet Desktop, an unofficial derivative of PuruPuru PNGTuber.

By contributing software code or documentation text, you agree that your contribution is provided under the Apache License 2.0 unless explicitly stated otherwise before submission.

## Before contributing

- Read [README.md](../README.md), [SECURITY.md](./SECURITY.md), and [SUPPORT.md](./SUPPORT.md).
- Do not submit assets unless you own them or have permission to contribute them.
- Do not include private characters, raw material folders, generated `.purupuru` files, backups, or screenshots containing private information.
- Do not commit API keys, Codex credentials, `.env` files, local paths, build output, or user-data preferences.
- Keep the upstream attribution and separate asset-license notices intact.

## Development checks

Run these before submitting changes:

```bash
npm ci
npm test
uv run python scripts/verify_vendor_checksums.py
```

## Pull request expectations

- Keep changes focused.
- Update documentation when behavior changes.
- Include before/after screenshots for UI changes when useful.
- Avoid large refactors mixed with feature changes.
- Review license and asset impact for any new files. Code and documentation are Apache-2.0; bundled/demo visual assets are separate.
- For desktop changes, confirm the compact transparent-avatar UI still works and include a Windows smoke-test note.
