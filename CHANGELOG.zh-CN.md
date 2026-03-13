# 更新日志

语言：简体中文 | [English](CHANGELOG.md)

本项目的重要变更会记录在此文件中。
格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，
版本遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

## [0.2.9] - 2026-03-13

- fix: 修复 skill setup guide 路径断言的跨平台兼容性问题，确保 Linux 和 macOS 上的 CI / Release VSIX 通过。

## [0.2.8] - 2026-03-13

- feat: 在 skill 指南、提示词模板与项目接入流程中保留 Where 的层级布局语义。
- test: 为 Codex setup guide 生成逻辑补充回归测试。
- refactor: 拆分 skill setup guide 生成模块，便于独立测试。
