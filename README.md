## Rust Code Pro

Rust Code Pro is a comprehensive Visual Studio Code (VS Code) extension designed to enhance your Rust development experience. It provides a suite of tools to format, lint, test, check, and fix Rust code using `cargo fmt`, `cargo clippy`, `cargo test`, `cargo check`, and `cargo fix`.

## Features

- **Code Formatting**: Automatically format your Rust code using `cargo fmt`.
- **Linting**: Lint your Rust code using `cargo clippy`, including support for pedantic lints.
- **Testing**: Run tests for your Rust projects using `cargo test`.
- **Code Checking**: Check your Rust code for errors using `cargo check`.
- **Building**: Build your Rust projects using `cargo build`.
- **Documentation**: Generate and open documentation for your Rust code using `cargo doc`.
- **Clean Projects**: Clean your Rust projects using `cargo clean`.
- **Run Projects**: Run your Rust projects using `cargo run`.
- **Benchmarking**: Benchmark your Rust code using `cargo bench`.
- **Real-time Linting**: Enable real-time linting feedback as you type.
- **Workspace Diagnostics Summary**: Run diagnostics across the entire workspace and display a summary.
- **Refactor Suggestions**: Run `cargo fix` to apply suggested refactorings.
- **Toolchain Management**: Install, update, and switch between Rust toolchains using `rustup`.
- **Cargo Features Management**: Enable or disable specific Cargo features.
- **Send to Playground**: Send your Rust code to Rust Playground for easy sharing.
- **Profile Management**: Create, edit, switch, and delete configuration profiles.

## Installation

1. Install Visual Studio Code.
2. Open the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of the window.
3. Search for "Rust Code Pro".
4. Click the Install button.

## Configuration

The extension provides several configuration options that can be customized in your VS Code settings. You can access the settings by navigating to `File > Preferences > Settings` and searching for `Rust Code Pro`.

### Configuration Options

- `rustCodePro.realTimeLinting`: Enable or disable real-time linting feedback (default: `true`).
- `rustCodePro.formatOnSave`: Enable or disable formatting on save (default: `true`).
- `rustCodePro.testOnSave`: Enable or disable running tests on save (default: `false`).
- `rustCodePro.checkOnSave`: Enable or disable checking code on save (default: `false`).
- `rustCodePro.buildOnSave`: Enable or disable building code on save (default: `false`).
- `rustCodePro.formatArgs`: Additional arguments for `cargo fmt` (default: `[]`).
- `rustCodePro.lintArgs`: Additional arguments for `cargo clippy` (default: `[]`).
- `rustCodePro.outputChannelName`: Name of the output channel (default: `Rust Code Pro`).
- `rustCodePro.autoClearOutput`: Automatically clear the output channel before each command (default: `false`).
- `rustCodePro.diagnosticsCommand`: Command to use for workspace diagnostics (default: `cargo check`).
- `rustCodePro.enableClippyPedantic`: Enable Clippy pedantic lints for stricter code checks (default: `false`).
- `rustCodePro.profiles`: Configuration profiles for different workflows (default: see below).
- `rustCodePro.activeProfile`: The currently active configuration profile (default: `default`).
- `rustCodePro.diagnosticsCategories`: Enable/disable specific categories in the diagnostics report (default: `{ errors: true, warnings: true, performance: true, pitfalls: true }`).

### Default Profile

```json
{
  "default": {
    "enableClippyPedantic": false,
    "autoClearOutput": true,
    "realTimeLinting": true,
    "formatOnSave": true,
    "testOnSave": false,
    "checkOnSave": false,
    "buildOnSave": false,
    "outputChannelName": "Rust Code Pro"
  }
}
```

## Usage

The extension provides various commands that can be executed from the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) or by configuring keybindings. Below is a list of available commands:

- `rustcodepro.rustFmt`: Run `cargo fmt` to format code.
- `rustcodepro.rustClippy`: Run `cargo clippy` to lint code.
- `rustcodepro.rustTest`: Run `cargo test` to run tests.
- `rustcodepro.rustCheck`: Run `cargo check` to check code.
- `rustcodepro.rustBuild`: Run `cargo build` to build code.
- `rustcodepro.rustDoc`: Run `cargo doc` to generate documentation.
- `rustcodepro.rustClean`: Run `cargo clean` to clean the project.
- `rustcodepro.rustRun`: Run `cargo run` to run the project.
- `rustcodepro.rustBench`: Run `cargo bench` to benchmark code.
- `rustcodepro.rustFmtFile`: Format the current file with `cargo fmt`.
- `rustcodepro.rustClippyFile`: Lint the current file with `cargo clippy`.
- `rustcodepro.editRustfmtConfig`: Edit the `rustfmt.toml` configuration file.
- `rustcodepro.editClippyConfig`: Edit the `clippy.toml` configuration file.
- `rustcodepro.rustFix`: Run `cargo fix` to apply suggested refactorings.
- `rustcodepro.rustAnalyzer`: Run `rust-analyzer diagnostics`.
- `rustcodepro.showQuickPick`: Show a quick pick menu to select and run commands.
- `rustcodepro.workspaceDiagnosticsSummary`: Show a summary of workspace diagnostics.
- `rustcodepro.installToolchain`: Install a Rust toolchain using `rustup`.
- `rustcodepro.updateToolchain`: Update Rust toolchains using `rustup`.
- `rustcodepro.switchToolchain`: Switch to a different Rust toolchain using `rustup`.
- `rustcodepro.cargoGenerate`: Run `cargo-generate` to scaffold new projects.
- `rustcodepro.manageCargoFeatures`: Enable or disable specific Cargo features.
- `rustcodepro.sendToPlayground`: Send the current code to Rust Playground.
- `rustcodepro.manageProfiles`: Manage configuration profiles.
- `rustcodepro.createProfile`: Create a new configuration profile.
- `rustcodepro.editProfile`: Edit an existing configuration profile.
- `rustcodepro.deleteProfile`: Delete an existing configuration profile.
- `rustcodepro.switchProfile`: Switch to a different configuration profile.

## Development

To develop and test this extension, clone the repository and run the following commands:

```sh
git clone https://github.com/genc-murat/rust-formatter-linter-plus.git
cd rust-formatter-linter-plus
npm install
npm run watch
```

Open the project in VS Code and press `F5` to start a new VS Code window with the extension loaded.

### Scripts

- `vscode:prepublish`: Compiles the extension.
- `compile`: Compiles the TypeScript source files.
- `watch`: Watches for changes and recompiles the extension.
- `pretest`: Compiles and lints the extension before running tests.
- `lint`: Lints the TypeScript source files using ESLint.
- `test`: Runs the tests for the extension.

### Testing

Run the tests using the following command:

```sh
npm test
```

## Contributing

Contributions are welcome! If you have suggestions for new features or improvements, please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, please open an issue on the [GitHub repository](https://github.com/genc-murat/rust-formatter-linter-plus).

---

Thank you for using Rust Code Pro! We hope it enhances your Rust development experience. Happy coding!