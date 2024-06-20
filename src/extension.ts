import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function runCargoCommand(command: string, args: string[], outputChannel: vscode.OutputChannel, onDone?: () => void) {
    const process = cp.spawn(command, args, { shell: true });
    outputChannel.appendLine(`Running: ${command} ${args.join(' ')}`);

    process.stdout.on('data', (data) => {
        outputChannel.appendLine(data.toString());
        saveOutputToFile(command, data.toString());
    });

    process.stderr.on('data', (data) => {
        outputChannel.appendLine(data.toString());
        saveOutputToFile(command, data.toString());
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
}

function saveOutputToFile(command: string, output: string) {
    const outputFilePath = path.join(vscode.workspace.rootPath || '', `${command.replace(' ', '_')}_output.log`);
    fs.appendFileSync(outputFilePath, output);
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Rust Formatter and Linter Extension is now active!');

    const outputChannel = vscode.window.createOutputChannel('Rust Formatter and Linter');

    let formatCommand = vscode.commands.registerCommand('extension.rustFmt', () => {
        const config = vscode.workspace.getConfiguration('rustFormatterLinter');
        const args = config.get<string[]>('formatArgs') || [];
        runCargoCommand('cargo fmt', args, outputChannel);
    });

    let lintCommand = vscode.commands.registerCommand('extension.rustClippy', () => {
        const config = vscode.workspace.getConfiguration('rustFormatterLinter');
        const args = config.get<string[]>('lintArgs') || [];
        runCargoCommand('cargo clippy', args, outputChannel, () => {
            // Display lint errors and warnings
            cp.exec('cargo clippy', (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage('Cargo Clippy failed');
                } else {
                    const errors = parseClippyOutput(stdout);
                    displayDiagnostics(errors);
                }
            });
        });
    });

    let testCommand = vscode.commands.registerCommand('extension.rustTest', () => {
        runCargoCommand('cargo test', [], outputChannel, () => {
            // Display test results
            cp.exec('cargo test', (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage('Cargo Test failed');
                    outputChannel.appendLine(stdout.toString());
                    outputChannel.appendLine(stderr.toString());
                } else {
                    vscode.window.showInformationMessage('Cargo Test completed successfully.');
                    outputChannel.appendLine(stdout.toString());
                }
            });
        });
    });

    let formatFileCommand = vscode.commands.registerCommand('extension.rustFmtFile', (uri: vscode.Uri) => {
        runCargoCommand('cargo fmt --', [uri.fsPath], outputChannel);
    });

    let lintFileCommand = vscode.commands.registerCommand('extension.rustClippyFile', (uri: vscode.Uri) => {
        runCargoCommand('cargo clippy --', ['--', uri.fsPath], outputChannel);
    });

    let editRustfmtConfigCommand = vscode.commands.registerCommand('extension.editRustfmtConfig', () => {
        const configPath = path.join(vscode.workspace.rootPath || '', 'rustfmt.toml');
        openConfigFile(configPath);
    });

    let editClippyConfigCommand = vscode.commands.registerCommand('extension.editClippyConfig', () => {
        const configPath = path.join(vscode.workspace.rootPath || '', 'clippy.toml');
        openConfigFile(configPath);
    });

    let fixCommand = vscode.commands.registerCommand('extension.rustFix', () => {
        runCargoCommand('cargo fix', [], outputChannel);
    });

    context.subscriptions.push(formatCommand);
    context.subscriptions.push(lintCommand);
    context.subscriptions.push(testCommand);
    context.subscriptions.push(formatFileCommand);
    context.subscriptions.push(lintFileCommand);
    context.subscriptions.push(editRustfmtConfigCommand);
    context.subscriptions.push(editClippyConfigCommand);
    context.subscriptions.push(fixCommand);

    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'rust') {
            const config = vscode.workspace.getConfiguration('rustFormatterLinter');
            if (config.get<boolean>('formatOnSave')) {
                runCargoCommand('cargo fmt', [], outputChannel);
            }
            if (config.get<boolean>('testOnSave')) {
                runCargoCommand('cargo test', [], outputChannel, () => {
                    // Display test results
                    cp.exec('cargo test', (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage('Cargo Test failed');
                            outputChannel.appendLine(stdout.toString());
                            outputChannel.appendLine(stderr.toString());
                        } else {
                            vscode.window.showInformationMessage('Cargo Test completed successfully.');
                            outputChannel.appendLine(stdout.toString());
                        }
                    });
                });
            }
        }
    });

    // Durum çubuğunda format, lint, test ve fix düğmeleri ekleyin
    const statusBarFormatItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarFormatItem.command = 'extension.rustFmt';
    statusBarFormatItem.text = '$(check) Rust Format';
    statusBarFormatItem.tooltip = 'Run cargo fmt';
    statusBarFormatItem.show();
    context.subscriptions.push(statusBarFormatItem);

    const statusBarLintItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarLintItem.command = 'extension.rustClippy';
    statusBarLintItem.text = '$(alert) Rust Lint';
    statusBarLintItem.tooltip = 'Run cargo clippy';
    statusBarLintItem.show();
    context.subscriptions.push(statusBarLintItem);

    const statusBarTestItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarTestItem.command = 'extension.rustTest';
    statusBarTestItem.text = '$(beaker) Rust Test';
    statusBarTestItem.tooltip = 'Run cargo test';
    statusBarTestItem.show();
    context.subscriptions.push(statusBarTestItem);

    const statusBarFixItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarFixItem.command = 'extension.rustFix';
    statusBarFixItem.text = '$(tools) Rust Fix';
    statusBarFixItem.tooltip = 'Run cargo fix';
    statusBarFixItem.show();
    context.subscriptions.push(statusBarFixItem);
}

export function deactivate() {
    console.log('Rust Formatter and Linter Extension is now deactivated!');
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

function displayDiagnostics(diagnostics: Map<string, vscode.Diagnostic[]>) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('rust');
    diagnosticCollection.clear();

    diagnostics.forEach((diagnostics, filePath) => {
        const fileUri = vscode.Uri.file(filePath);
        diagnosticCollection.set(fileUri, diagnostics);
    });
}

function openConfigFile(configPath: string) {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, '');
    }
    vscode.workspace.openTextDocument(configPath).then(doc => {
        vscode.window.showTextDocument(doc);
    });
}
