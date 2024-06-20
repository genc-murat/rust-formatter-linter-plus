# Rust Formatter and Linter Plus

**Rust Formatter and Linter Plus** is a comprehensive VS Code extension designed to streamline Rust development. It provides functionalities such as code formatting, linting, testing, and automatic fixing using `cargo fmt`, `cargo clippy`, `cargo test`, and `cargo fix`.

## Features

- **Code Formatting**: Automatically format your Rust code using `cargo fmt`.
- **Linting**: Lint your Rust code with `cargo clippy` to catch common mistakes and improve code quality.
- **Testing**: Run your Rust tests with `cargo test` and view the results directly in VS Code.
- **Automatic Fixing**: Automatically fix common issues in your Rust code using `cargo fix`.
- **Configuration Editing**: Easily edit your `rustfmt.toml` and `clippy.toml` configuration files within VS Code.
- **Status Bar Integration**: Conveniently access format, lint, test, and fix commands from the VS Code status bar.
- **Customizable Settings**: Configure format, lint, and test options through the VS Code settings.

## Installation

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking the Extensions icon in the Activity Bar on the side of the window or by pressing `Ctrl+Shift+X`.
3. Search for "Rust Formatter and Linter Plus".
4. Click "Install" to install the extension.

## Usage

### Commands

- **Run cargo fmt**: Format your Rust code using `cargo fmt`.
  - Command Palette: `Rust: Run cargo fmt`
  - Status Bar: Click the `$(check) Rust Format` button

- **Run cargo clippy**: Lint your Rust code using `cargo clippy`.
  - Command Palette: `Rust: Run cargo clippy`
  - Status Bar: Click the `$(alert) Rust Lint` button

- **Run cargo test**: Run your Rust tests using `cargo test`.
  - Command Palette: `Rust: Run cargo test`
  - Status Bar: Click the `$(beaker) Rust Test` button

- **Run cargo fix**: Automatically fix common issues in your Rust code using `cargo fix`.
  - Command Palette: `Rust: Run cargo fix`
  - Status Bar: Click the `$(tools) Rust Fix` button

- **Format this file with cargo fmt**: Format a specific file using `cargo fmt`.
  - Command Palette: `Rust: Format this file with cargo fmt`
  - Right-click context menu: Select `Format this file with cargo fmt`

- **Lint this file with cargo clippy**: Lint a specific file using `cargo clippy`.
  - Command Palette: `Rust: Lint this file with cargo clippy`
  - Right-click context menu: Select `Lint this file with cargo clippy`

- **Edit rustfmt.toml**: Edit the `rustfmt.toml` configuration file.
  - Command Palette: `Rust: Edit rustfmt.toml`

- **Edit clippy.toml**: Edit the `clippy.toml` configuration file.
  - Command Palette: `Rust: Edit clippy.toml`

### Settings

You can customize the extension settings by going to the VS Code settings (`Ctrl+,`) and searching for `Rust Formatter and Linter Plus`. The following settings are available:

- `rustFormatterLinter.formatOnSave`: Run `cargo fmt` on save (default: `true`).
- `rustFormatterLinter.testOnSave`: Run `cargo test` on save (default: `false`).
- `rustFormatterLinter.formatArgs`: Additional arguments for `cargo fmt`.
- `rustFormatterLinter.lintArgs`: Additional arguments for `cargo clippy`.

### Status Bar Integration

The extension adds convenient buttons to the VS Code status bar for quick access to format, lint, test, and fix commands. Simply click the corresponding button to run the desired command.

## Contributing

If you would like to contribute to this project, please fork the repository and submit a pull request. We welcome all contributions!


## Acknowledgements

Special thanks to the Rust community and the contributors of the Rust tools and libraries used in this extension.

---

We hope you find Rust Formatter and Linter Plus useful! If you have any questions, issues, or suggestions, please feel free to open an issue on the GitHub repository or contact us directly.
