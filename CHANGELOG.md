# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature to format specific files with `cargo fmt`.
- Feature to lint specific files with `cargo clippy`.
- Enhanced output display in a dedicated output channel for all commands.

### Fixed
- Issue where `cargo test` output was not being displayed in the output channel.
- Bug causing the extension to crash when no active editor was found.

## [0.0.3] - 2024-06-21

### Added
- Command to check Rust code for compilation errors using `cargo check`.
- Status bar button for quick access to the `cargo check` command.

### Fixed
- Minor improvements and bug fixes.

## [0.0.2] - 2024-06-21

### Added
- Status bar buttons for quick access to format, lint, test, and fix commands.
- Commands to format specific files with `cargo fmt`.
- Commands to lint specific files with `cargo clippy`.
- Improved handling of configuration files (`rustfmt.toml` and `clippy.toml`).

### Fixed
- Issue where output from commands was not correctly displayed in the output channel.

## [0.0.1] - 2024-06-20

### Added
- Initial release with core features:
  - Code Formatting with `cargo fmt`.
  - Linting with `cargo clippy`.
  - Testing with `cargo test`.
  - Automatic Fixing with `cargo fix`.
  - Configuration file editing.
  - Customizable settings for format, lint, and test options.
