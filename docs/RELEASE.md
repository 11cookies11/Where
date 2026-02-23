# Release Guide

## Extension Identity

- Extension ID: `11cookies11.where-progress`
- Package name: `where-progress`
- Current version: `0.1.0`

## Semantic Version Policy

- `MAJOR` (`x.0.0`): breaking behavior or config changes
- `MINOR` (`0.x.0`): backward-compatible features
- `PATCH` (`0.0.x`): bug fixes, docs, test hardening

## Pre-release Checklist

1. Run tests:
   - `npm test`
   - Optional: `npm run test:integration`
2. Run packaging check:
   - `npm run release:check`
3. Update `CHANGELOG.md` and `CHANGELOG.zh-CN.md`
4. Bump version in `package.json`

## Package and Publish

1. Package VSIX:
   - `npm run package:vsix`
2. Publish (after creating/pairing publisher credentials):
   - `npx vsce publish`

## CI

- Unit tests run on `ubuntu/windows/macos`
- Integration test runs on `ubuntu`
