# Changelog

Language: English | [简体中文](CHANGELOG.zh-CN.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-03-27

- feat: auto-archive overwritten plans by default and add richer plan history management actions.
- docs: update skill prompts and repo guidance so agents preserve disappearing plan content in history.

## [0.2.9] - 2026-03-13

- fix: make skill setup guide path assertions cross-platform so CI and Release VSIX pass on Linux and macOS.

## [0.2.8] - 2026-03-13

- feat: preserve Where hierarchy semantics across skill guidance, prompt templates, and setup flow.
- test: add regression coverage for Codex setup guide generation.
- refactor: extract skill setup guide builders into a testable module.
