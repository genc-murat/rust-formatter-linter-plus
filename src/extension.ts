import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function runCargoCommand(command: string, args: string[], outputChannel: vscode.OutputChannel, cwd: string, onDone?: () => void) {
    const process = cp.spawn(command, args, { shell: true, cwd: cwd });
    outputChannel.appendLine(`Running: ${command} ${args.join(' ')} in ${cwd}`);

    process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`stdout: ${output}`); // Debugging statement
        outputChannel.appendLine(output);
    });

    process.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`stderr: ${output}`); // Debugging statement
        outputChannel.appendLine(output);
    });

    process.on('close', (code) => {
        if (code !== 0) {
            vscode.window.showErrorMessage(`${command} failed with exit code ${code}`);
        } else {
            vscode.window.showInformationMessage(`${command} completed successfully.`);
        }
        if (onDone) {
            onDone();
        }
    });

    process.on('error', (err) => {
        vscode.window.showErrorMessage(`Failed to start process: ${err.message}`);
    });
}

function findCargoTomlDir(currentDir: string): string | null {
    const rootDir = path.parse(currentDir).root;
    let dir = currentDir;

    while (dir !== rootDir) {
        if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }

    return null;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Rust Formatter and Linter Plus is now active!');

    const outputChannel = vscode.window.createOutputChannel('Rust Formatter and Linter Plus');
    outputChannel.show(true); // Ensure the output channel is shown

    let formatCommand = vscode.commands.registerCommand('extension.rustFmt', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        const config = vscode.workspace.getConfiguration('rustFormatterLinter');
        const args = config.get<string[]>('formatArgs') || [];
        runCargoCommand('cargo fmt', args, outputChannel, projectDir);
    });

    let lintCommand = vscode.commands.registerCommand('extension.rustClippy', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        const config = vscode.workspace.getConfiguration('rustFormatterLinter');
        const args = config.get<string[]>('lintArgs') || [];
        runCargoCommand('cargo clippy', args, outputChannel, projectDir, () => {
            // Display lint errors and warnings
            cp.exec('cargo clippy', { cwd: projectDir }, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage('Cargo Clippy failed');
                } else {
                    const errors = parseClippyOutput(stdout);
                    displayDiagnostics(errors, outputChannel);
                }
            });
        });
    });

    let testCommand = vscode.commands.registerCommand('extension.rustTest', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        runCargoCommand('cargo test', [], outputChannel, projectDir);
    });

    let checkCommand = vscode.commands.registerCommand('extension.rustCheck', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        runCargoCommand('cargo check', [], outputChannel, projectDir);
    });

    let buildCommand = vscode.commands.registerCommand('extension.rustBuild', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        runCargoCommand('cargo build', [], outputChannel, projectDir);
    });

    let formatFileCommand = vscode.commands.registerCommand('extension.rustFmtFile', (uri: vscode.Uri) => {
        const projectDir = findCargoTomlDir(uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        runCargoCommand('cargo fmt --', [uri.fsPath], outputChannel, projectDir);
    });

    let lintFileCommand = vscode.commands.registerCommand('extension.rustClippyFile', (uri: vscode.Uri) => {
        const projectDir = findCargoTomlDir(uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        runCargoCommand('cargo clippy --', ['--', uri.fsPath], outputChannel, projectDir);
    });

    let editRustfmtConfigCommand = vscode.commands.registerCommand('extension.editRustfmtConfig', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        const configPath = path.join(projectDir, 'rustfmt.toml');
        openConfigFile(configPath, outputChannel);
    });

    let editClippyConfigCommand = vscode.commands.registerCommand('extension.editClippyConfig', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        const configPath = path.join(projectDir, 'clippy.toml');
        openConfigFile(configPath, outputChannel);
    });

    let fixCommand = vscode.commands.registerCommand('extension.rustFix', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage('Cargo.toml not found in the project.');
            return;
        }
        runCargoCommand('cargo fix', [], outputChannel, projectDir);
    });

    context.subscriptions.push(formatCommand);
    context.subscriptions.push(lintCommand);
    context.subscriptions.push(testCommand);
    context.subscriptions.push(checkCommand);
    context.subscriptions.push(buildCommand);
    context.subscriptions.push(formatFileCommand);
    context.subscriptions.push(lintFileCommand);
    context.subscriptions.push(editRustfmtConfigCommand);
    context.subscriptions.push(editClippyConfigCommand);
    context.subscriptions.push(fixCommand);

    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'rust') {
            const projectDir = findCargoTomlDir(document.uri.fsPath);
            if (!projectDir) {
                vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                return;
            }
            const config = vscode.workspace.getConfiguration('rustFormatterLinter');
            if (config.get<boolean>('formatOnSave')) {
                runCargoCommand('cargo fmt', [], outputChannel, projectDir);
            }
            if (config.get<boolean>('testOnSave')) {
                runCargoCommand('cargo test', [], outputChannel, projectDir);
            }
            if (config.get<boolean>('checkOnSave')) {
                runCargoCommand('cargo check', [], outputChannel, projectDir);
            }
            if (config.get<boolean>('buildOnSave')) {
                runCargoCommand('cargo build', [], outputChannel, projectDir);
            }
        }
    });

    // Add a status bar item for a dropdown of commands
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'extension.showQuickPick';
    statusBarItem.text = '$(menu) Rust Actions';
    statusBarItem.tooltip = 'Show Rust commands';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    let showQuickPickCommand = vscode.commands.registerCommand('extension.showQuickPick', async () => {
        const items: vscode.QuickPickItem[] = [
            { label: 'Run cargo fmt', description: 'Format Rust code' },
            { label: 'Run cargo clippy', description: 'Lint Rust code' },
            { label: 'Run cargo test', description: 'Run Rust tests' },
            { label: 'Run cargo check', description: 'Check Rust code' },
            { label: 'Run cargo build', description: 'Build Rust code' },
            { label: 'Run cargo fix', description: 'Fix Rust code' }
        ];

        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a Rust command'
        });

        if (!selectedItem) {
            return;
        }

        switch (selectedItem.label) {
            case 'Run cargo fmt':
                vscode.commands.executeCommand('extension.rustFmt');
                break;
            case 'Run cargo clippy':
                vscode.commands.executeCommand('extension.rustClippy');
                break;
            case 'Run cargo test':
                vscode.commands.executeCommand('extension.rustTest');
                break;
            case 'Run cargo check':
                vscode.commands.executeCommand('extension.rustCheck');
                break;
            case 'Run cargo build':
                vscode.commands.executeCommand('extension.rustBuild');
                break;
            case 'Run cargo fix':
                vscode.commands.executeCommand('extension.rustFix');
                break;
        }
    });

    context.subscriptions.push(showQuickPickCommand);
}

export function deactivate() {
    console.log('Rust Formatter and Linter Plus is now deactivated!');
}

function parseClippyOutput(output: string): Map<string, vscode.Diagnostic[]> {
    const diagnostics = new Map<string, vscode.Diagnostic[]>();
    const lines = output.split('\n');
    for (const line of lines) {
        const match = line.match(/^(.*):(\d+):(\d+):\s*(\w+):\s*(.*)$/);
        if (match) {
            const [ , filePath, lineStr, columnStr, severity, message ] = match;
            const line = parseInt(lineStr, 10) - 1;
            const column = parseInt(columnStr, 10) - 1;
            const range = new vscode.Range(new vscode.Position(line, column), new vscode.Position(line, column));
            const diagnostic = new vscode.Diagnostic(range, message, mapSeverity(severity));
            diagnostic.source = 'clippy';

            if (!diagnostics.has(filePath)) {
                diagnostics.set(filePath, []);
            }
            diagnostics.get(filePath)!.push(diagnostic);
        }
    }
    return diagnostics;
}

function mapSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'note':
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Information;
    }
}

function displayDiagnostics(diagnostics: Map<string, vscode.Diagnostic[]>, outputChannel: vscode.OutputChannel) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
    diagnosticCollection.clear();

    diagnostics.forEach((diagnostics, filePath) => {
        const fileUri = vscode.Uri.file(filePath);
        diagnosticCollection.set(fileUri, diagnostics);
        outputChannel.appendLine(`Diagnostics for ${filePath}:`);
        diagnostics.forEach(diagnostic => {
            outputChannel.appendLine(`  Line ${diagnostic.range.start.line + 1}, Column ${diagnostic.range.start.character + 1}: ${diagnostic.message}`);
        });
    });
}

function openConfigFile(configPath: string, outputChannel: vscode.OutputChannel) {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, '');
    }
    vscode.workspace.openTextDocument(configPath).then(doc => {
        vscode.window.showTextDocument(doc);
    });
    outputChannel.appendLine(`Opened configuration file: ${configPath}`);
}
