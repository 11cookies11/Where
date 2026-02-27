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
2. Publish to Marketplace (after creating/pairing publisher credentials):
   - Direct publish (recommended): `npx @vscode/vsce publish`
   - Manual upload: `npx @vscode/vsce package` then upload `.vsix` in Marketplace Publisher portal

## Marketplace Credentials

1. Create Publisher:
   - `https://marketplace.visualstudio.com/manage`
2. Create PAT in Azure DevOps with Marketplace publish/manage scope:
   - `https://dev.azure.com`
3. Local publish:
   - `npx @vscode/vsce login <publisher-id>`
   - `npx @vscode/vsce publish`

## GitHub Action Auto Publish

- Workflow: `.github/workflows/publish-marketplace.yml`
- Trigger: tag push `v*.*.*` (and manual dispatch)
- Required secret:
  - `VSCE_PAT`

## CI

- Unit tests run on `ubuntu/windows/macos`
- Integration test runs on `ubuntu`
