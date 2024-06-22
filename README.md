# RustCodePro

**RustCodePro** is a comprehensive VS Code extension designed to streamline Rust development. It provides functionalities such as code formatting, linting, testing, checking, and automatic fixing using `cargo fmt`, `cargo clippy`, `cargo test`, `cargo check`, and `cargo fix`.

## Features

- **Code Formatting**: Automatically format your Rust code using `cargo fmt`.
- **Linting**: Lint your Rust code with `cargo clippy` to catch common mistakes and improve code quality.
- **Testing**: Run your Rust tests with `cargo test` and view the results directly in VS Code.
- **Checking**: Check your Rust code for compilation errors using `cargo check`.
- **Automatic Fixing**: Automatically fix common issues in your Rust code using `cargo fix`.
- **Configuration Editing**: Easily edit your `rustfmt.toml` and `clippy.toml` configuration files within VS Code.
- **Status Bar Integration**: Conveniently access format, lint, test, check, and fix commands from the VS Code status bar.
- **Customizable Settings**: Configure format, lint, test, and check options through the VS Code settings.
- **Real-time Linting**: Enable real-time linting feedback.
- **Format on Save**: Automatically format your code on save.
- **Run Tests on Save**: Automatically run tests on save.
- **Run Check on Save**: Automatically check for errors on save.
- **Run Build on Save**: Automatically build your code on save.
- **Workspace Diagnostics**: Run diagnostics across the entire workspace and show a summary.
- **Toolchain Management**: Install, update, and switch between Rust toolchains.
- **Cargo Generate**: Scaffold new projects using `cargo-generate`.
- **Refactor Suggestions**: Apply suggested refactorings using `cargo fix`.
- **Configuration Profiles**: Switch between different configuration profiles for various workflows.
- **Diagnostics Categories**: Enable or disable specific categories in the diagnostics report.
- **Performance Suggestions**: Identify and optimize performance issues.
- **Common Pitfalls**: Detect and avoid common pitfalls in Rust code.

## Installation

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking the Extensions icon in the Activity Bar on the side of the window or by pressing `Ctrl+Shift+X`.
3. Search for "RustCodePro".
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

- **Run cargo check**: Check your Rust code for compilation errors using `cargo check`.
  - Command Palette: `Rust: Run cargo check`
  - Status Bar: Click the `$(checklist) Rust Check` button

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

- **Show Rust Commands**: Show available Rust commands.
  - Command Palette: `Rust: Show Rust Commands`

- **Run rust-analyzer diagnostics**: Run diagnostics using rust-analyzer.
  - Command Palette: `Rust: Run rust-analyzer diagnostics`

- **Show Workspace Diagnostics Summary**: Run diagnostics across the entire workspace and show a summary.
  - Command Palette: `Rust: Show Workspace Diagnostics Summary`

- **Install Rust Toolchain**: Install a specific Rust toolchain.
  - Command Palette: `Rust: Install Rust Toolchain`

- **Update Rust Toolchain**: Update all Rust toolchains.
  - Command Palette: `Rust: Update Rust Toolchain`

- **Switch Rust Toolchain**: Switch to a specific Rust toolchain.
  - Command Palette: `Rust: Switch Rust Toolchain`

- **Run cargo-generate**: Scaffold new projects using `cargo-generate`.
  - Command Palette: `Rust: Run cargo-generate`

- **Run refactor suggestions**: Apply suggested refactorings using `cargo fix`.
  - Command Palette: `Rust: Run refactor suggestions`

- **Switch Configuration Profile**: Switch between different configuration profiles for various workflows.
  - Command Palette: `Rust: Switch Configuration Profile`

### Settings

You can customize the extension settings by going to the VS Code settings (`Ctrl+,`) and searching for `RustCodePro`. The following settings are available:

- `rustCodePro.realTimeLinting`: Enable real-time linting feedback (default: `true`).
- `rustCodePro.formatOnSave`: Run `cargo fmt` on save (default: `true`).
- `rustCodePro.testOnSave`: Run `cargo test` on save (default: `false`).
- `rustCodePro.checkOnSave`: Run `cargo check` on save (default: `false`).
- `rustCodePro.buildOnSave`: Run `cargo build` on save (default: `false`).
- `rustCodePro.formatArgs`: Additional arguments for `cargo fmt`.
- `rustCodePro.lintArgs`: Additional arguments for `cargo clippy`.
- `rustCodePro.outputChannelName`: Name of the output channel (default: `Rust Code Pro`).
- `rustCodePro.autoClearOutput`: Automatically clear the output channel before each command (default: `false`).
- `rustCodePro.diagnosticsCommand`: Command to use for workspace diagnostics (`cargo check` or `cargo clippy`) (default: `cargo check`).
- `rustCodePro.enableClippyPedantic`: Enable Clippy pedantic lints for stricter code checks (default: `false`).
- `rustCodePro.profiles`: Configuration profiles for different workflows.
- `rustCodePro.diagnosticsCategories`: Enable/disable specific categories in the diagnostics report.

### Status Bar Integration

The extension adds convenient buttons to the VS Code status bar for quick access to format, lint, test, check, and fix commands. Simply click the corresponding button to run the desired command.

## Contributing

If you would like to contribute to this project, please fork the repository and submit a pull request. We welcome all contributions!

## Acknowledgements

Special thanks to the Rust community and the contributors of the Rust tools and libraries used in this extension.

---

We hope you find RustCodePro useful! If you have any questions, issues, or suggestions, please feel free to open an issue on the GitHub repository or contact us directly.