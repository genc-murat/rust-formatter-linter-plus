import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';

interface RustError {
    filePath: string;
    line: number;
    column: number;
    severity: string;
    message: string;
}

let commandStatusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
const diagnosticCollection = vscode.languages.createDiagnosticCollection('rust');

function createCommandStatusBarItem() {
    if (!commandStatusBarItem) {
        commandStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }
    commandStatusBarItem.show();
}

function updateCommandStatusBarItem(message: string, tooltip: string, success: boolean) {
    if (commandStatusBarItem) {
        if (success) {
            commandStatusBarItem.text = `$(check) ${message}`;
            commandStatusBarItem.tooltip = tooltip;
        } else {
            commandStatusBarItem.text = `$(alert) ${message}`;
            commandStatusBarItem.tooltip = tooltip;
        }
        setTimeout(() => commandStatusBarItem.hide(), 5000);
    }
}

async function runCommand(
    command: string,
    args: string[],
    outputChannel: vscode.OutputChannel,
    cwd: string,
    source: string,
    onDone?: (success: boolean) => void
) {
    createCommandStatusBarItem();
    const config = vscode.workspace.getConfiguration('rustFormatterLinter');
    if (config.get<boolean>('autoClearOutput')) {
        outputChannel.clear();
    }

    const timestamp = new Date().toLocaleString();
    outputChannel.appendLine(`\n[${timestamp}] Running: ${command} ${args.join(' ')} in ${cwd}`);
    commandStatusBarItem.text = `$(sync~spin) Running: ${command}`;
    commandStatusBarItem.tooltip = `Running: ${command} ${args.join(' ')} in ${cwd}`;

    const proc = cp.spawn(command, args, { shell: true, cwd: cwd });

    proc.stdout.on('data', (data) => {
        const output = data.toString();
        outputChannel.appendLine(`stdout: ${output}`);
    });

    proc.stderr.on('data', (data) => {
        const output = data.toString();
        outputChannel.appendLine(`stderr: ${output}`);
    });

    proc.on('close', (code) => {
        if (code !== 0) {
            vscode.window.showErrorMessage(`${command} failed with exit code ${code}`);
            updateCommandStatusBarItem(`${command} failed`, `Exit code: ${code}`, false);
            outputChannel.appendLine(`[${timestamp}] ${command} failed with exit code ${code}`);
        } else {
            vscode.window.showInformationMessage(`${command} completed successfully.`);
            updateCommandStatusBarItem(`${command} completed`, `Successfully completed ${command}`, true);
            outputChannel.appendLine(`[${timestamp}] ${command} completed successfully.`);
        }
        if (onDone) {
            onDone(code === 0);
        }
    });

    proc.on('error', (err) => {
        vscode.window.showErrorMessage(`Failed to start process: ${err.message}`);
        updateCommandStatusBarItem(`Failed to start ${command}`, err.message, false);
        outputChannel.appendLine(`[${timestamp}] Failed to start process: ${err.message}`);
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

function isCargoWorkspace(dir: string): boolean {
    const cargoTomlPath = path.join(dir, 'Cargo.toml');
    if (!fs.existsSync(cargoTomlPath)) {
        return false;
    }

    const content = fs.readFileSync(cargoTomlPath, 'utf8');
    const cargoToml = toml.parse(content);

    return cargoToml.workspace !== undefined;
}

function getWorkspacePackages(dir: string): string[] {
    const cargoTomlPath = path.join(dir, 'Cargo.toml');
    if (!fs.existsSync(cargoTomlPath)) {
        return [];
    }

    const content = fs.readFileSync(cargoTomlPath, 'utf8');
    const cargoToml = toml.parse(content);

    if (cargoToml.workspace && cargoToml.workspace.members) {
        return cargoToml.workspace.members;
    }

    return [];
}

async function selectWorkspacePackage(dir: string): Promise<string | null> {
    const packages = getWorkspacePackages(dir);
    if (packages.length === 0) {
        return null;
    }

    const selectedPackage = await vscode.window.showQuickPick(packages, {
        placeHolder: 'Select a package'
    });

    return selectedPackage ? path.join(dir, selectedPackage) : null;
}

function checkRustAnalyzerInstalled(): boolean {
    try {
        cp.execSync('rust-analyzer --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

async function showAdditionalOptions(command: string): Promise<string[]> {
    const options = [];
    if (command === 'cargo build') {
        const release = await vscode.window.showQuickPick(['Debug', 'Release'], {
            placeHolder: 'Select build type'
        });
        if (release === 'Release') {
            options.push('--release');
        }
    } else if (command === 'cargo test') {
        const testOptions = await vscode.window.showQuickPick(['All Tests', 'Specific Test'], {
            placeHolder: 'Select test type'
        });
        if (testOptions === 'Specific Test') {
            const testName = await vscode.window.showInputBox({
                prompt: 'Enter the test name'
            });
            if (testName) {
                options.push(`--test ${testName}`);
            }
        }
    } else if (command === 'cargo bench') {
        const benchOptions = await vscode.window.showQuickPick(
            ['All Benchmarks', 'Specific Benchmark', 'Profile Benchmarks'],
            {
                placeHolder: 'Select benchmark type'
            }
        );
        if (benchOptions === 'Specific Benchmark') {
            const benchName = await vscode.window.showInputBox({
                prompt: 'Enter the benchmark name'
            });
            if (benchName) {
                options.push(`--bench ${benchName}`);
            }
        } else if (benchOptions === 'Profile Benchmarks') {
            const profileName = await vscode.window.showQuickPick(['dev', 'release'], {
                placeHolder: 'Select profile'
            });
            if (profileName) {
                options.push(`--profile ${profileName}`);
            }
        }
    } else if (command === 'cargo run') {
        const runOptions = await vscode.window.showQuickPick(['Default', 'Release'], {
            placeHolder: 'Select run type'
        });
        if (runOptions === 'Release') {
            options.push('--release');
        }
    } else if (command === 'cargo clippy') {
        const clippyOptions = await vscode.window.showQuickPick(['Default', 'Fix'], {
            placeHolder: 'Select clippy type'
        });
        if (clippyOptions === 'Fix') {
            options.push('--fix');
        }
    }
    return options;
}

function openConfigFile(configPath: string, outputChannel: vscode.OutputChannel) {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, '');
    }
    vscode.workspace.openTextDocument(configPath).then((doc) => {
        vscode.window.showTextDocument(doc);
    });
    outputChannel.appendLine(`Opened configuration file: ${configPath}`);
}

function parseClippyOutput(output: string): RustError[] {
    const errors: RustError[] = [];
    const lines = output.split('\n');

    lines.forEach((line) => {
        const match = line.match(/^(.*):(\d+):(\d+):\s*(\w+):\s*(.*)$/);
        if (match) {
            const [, filePath, lineStr, columnStr, severity, message] = match;
            errors.push({
                filePath,
                line: parseInt(lineStr, 10) - 1,
                column: parseInt(columnStr, 10) - 1,
                severity,
                message
            });
        }
    });

    return errors;
}

function parseRustAnalyzerOutput(output: string): RustError[] {
    const errors: RustError[] = [];
    const lines = output.split('\n');

    lines.forEach((line) => {
        const match = line.match(/^(.*):(\d+):(\d+):\s*(\w+):\s*(.*)$/);
        if (match) {
            const [, filePath, lineStr, columnStr, severity, message] = match;
            errors.push({
                filePath,
                line: parseInt(lineStr, 10) - 1,
                column: parseInt(columnStr, 10) - 1,
                severity,
                message
            });
        }
    });

    return errors;
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

function displayDiagnostics(diagnostics: RustError[], outputChannel: vscode.OutputChannel) {
    diagnosticCollection.clear();
    const diagnosticMap: { [key: string]: vscode.Diagnostic[] } = {};

    diagnostics.forEach((error) => {
        const fileUri = vscode.Uri.file(error.filePath);
        const range = new vscode.Range(
            new vscode.Position(error.line, error.column),
            new vscode.Position(error.line, error.column + 1)
        );
        const diagnostic = new vscode.Diagnostic(range, error.message, mapSeverity(error.severity));
        diagnostic.source = error.severity === 'error' ? 'clippy' : 'rust-analyzer';
        if (diagnosticMap[error.filePath]) {
            diagnosticMap[error.filePath].push(diagnostic);
        } else {
            diagnosticMap[error.filePath] = [diagnostic];
        }
    });

    Object.keys(diagnosticMap).forEach((filePath) => {
        const fileUri = vscode.Uri.file(filePath);
        diagnosticCollection.set(fileUri, diagnosticMap[filePath]);
        outputChannel.appendLine(`Diagnostics for ${filePath}:`);
        diagnosticMap[filePath].forEach((diagnostic) => {
            outputChannel.appendLine(
                `  Line ${diagnostic.range.start.line + 1}, Column ${
                    diagnostic.range.start.character + 1
                }: ${diagnostic.message}`
            );
            const fileLink = vscode.Uri.file(filePath).with({
                fragment: `${diagnostic.range.start.line + 1},${diagnostic.range.start.character + 1}`
            });
            outputChannel.appendLine(`  [Open in editor](${fileLink})`);
        });
    });
}

// New function to run workspace diagnostics
async function runWorkspaceDiagnostics(command: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folders found.');
        return;
    }

    const allDiagnostics: RustError[] = [];

    for (const folder of workspaceFolders) {
        const projectDir = findCargoTomlDir(folder.uri.fsPath);
        if (!projectDir) {
            vscode.window.showErrorMessage(`Cargo.toml not found in the workspace folder: ${folder.name}`);
            continue;
        }

        const isWorkspace = isCargoWorkspace(projectDir);
        const packageDir = isWorkspace ? await selectWorkspacePackage(projectDir) : projectDir;

        if (!packageDir) {
            vscode.window.showErrorMessage(`No package selected in the workspace folder: ${folder.name}`);
            continue;
        }

        const args = ['--message-format=json'];
        await new Promise<void>((resolve) => {
            runCommand(command, args, outputChannel, packageDir, command, (success) => {
                if (success) {
                    cp.exec(`${command} --message-format=json`, { cwd: packageDir }, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`${command} failed`);
                        } else {
                            const errors = parseClippyOutput(stdout);
                            allDiagnostics.push(...errors);
                        }
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    displayDiagnostics(allDiagnostics, outputChannel);
    showDiagnosticsSummary(allDiagnostics);
}

// Function to show diagnostics summary in a webview
function showDiagnosticsSummary(diagnostics: RustError[]) {
    const panel = vscode.window.createWebviewPanel(
        'rustDiagnosticsSummary',
        'Rust Diagnostics Summary',
        vscode.ViewColumn.One,
        {}
    );

    const diagnosticsHtml = diagnostics
        .map((diagnostic) => {
            const severityClass = diagnostic.severity === 'error' ? 'error' : 'warning';
            return `<tr class="${severityClass}">
                        <td>${diagnostic.filePath}</td>
                        <td>${diagnostic.line + 1}</td>
                        <td>${diagnostic.column + 1}</td>
                        <td>${diagnostic.severity}</td>
                        <td>${diagnostic.message}</td>
                    </tr>`;
        })
        .join('');

    panel.webview.html = `
        <html>
        <head>
            <style>
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    color: #EEF7FF;
                }
                th {
                    background-color: #4D869C;
                    text-align: left;
                }
                .error {
                    color: red;
                }
                .warning {
                    color: orange;
                }
            </style>
        </head>
        <body>
            <h1>Rust Diagnostics Summary</h1>
            <table>
                <tr>
                    <th>File</th>
                    <th>Line</th>
                    <th>Column</th>
                    <th>Severity</th>
                    <th>Message</th>
                </tr>
                ${diagnosticsHtml}
            </table>
        </body>
        </html>
    `;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Rust Formatter and Linter Plus is now active!');

    const config = vscode.workspace.getConfiguration('rustFormatterLinter');
    const outputChannelName = config.get<string>('outputChannelName') || 'Rust Formatter and Linter Plus';
    outputChannel = vscode.window.createOutputChannel(outputChannelName);
    outputChannel.show(true);

    const commands = [
        {
            command: 'extension.rustFmt',
            callback: async () => {
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
                const args = config.get<string[]>('formatArgs') || ['--', 'check'];
                runCommand('cargo fmt', args, outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustClippy',
            callback: async () => {
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
                const additionalArgs = await showAdditionalOptions('cargo clippy');
                runCommand(
                    'cargo clippy',
                    additionalArgs,
                    outputChannel,
                    projectDir,
                    'cargo',
                    (success) => {
                        if (success) {
                            cp.exec('cargo clippy', { cwd: projectDir }, (error, stdout, stderr) => {
                                if (error) {
                                    vscode.window.showErrorMessage('Cargo Clippy failed');
                                } else {
                                    const errors = parseClippyOutput(stdout);
                                    displayDiagnostics(errors, outputChannel);
                                }
                            });
                        }
                    }
                );
            }
        },
        {
            command: 'extension.rustTest',
            callback: async () => {
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
                const additionalArgs = await showAdditionalOptions('cargo test');
                runCommand('cargo test', additionalArgs, outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustCheck',
            callback: async () => {
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
                runCommand('cargo check', [], outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustBuild',
            callback: async () => {
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
                const additionalArgs = await showAdditionalOptions('cargo build');
                runCommand('cargo build', additionalArgs, outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustDoc',
            callback: async () => {
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
                runCommand('cargo doc', ['--open'], outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustClean',
            callback: async () => {
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
                runCommand('cargo clean', [], outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustRun',
            callback: async () => {
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
                const additionalArgs = await showAdditionalOptions('cargo run');
                runCommand('cargo run', additionalArgs, outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustBench',
            callback: async () => {
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
                const additionalArgs = await showAdditionalOptions('cargo bench');
                runCommand('cargo bench', additionalArgs, outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustFmtFile',
            callback: async (uri: vscode.Uri) => {
                const projectDir = findCargoTomlDir(uri.fsPath);
                if (!projectDir) {
                    vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                    return;
                }
                runCommand('cargo fmt --', [uri.fsPath], outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustClippyFile',
            callback: async (uri: vscode.Uri) => {
                const projectDir = findCargoTomlDir(uri.fsPath);
                if (!projectDir) {
                    vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                    return;
                }
                runCommand('cargo clippy --', ['--', uri.fsPath], outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.editRustfmtConfig',
            callback: async () => {
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
            }
        },
        {
            command: 'extension.editClippyConfig',
            callback: async () => {
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
            }
        },
        {
            command: 'extension.rustFix',
            callback: async () => {
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
                runCommand('cargo fix', [], outputChannel, projectDir, 'cargo');
            }
        },
        {
            command: 'extension.rustAnalyzer',
            callback: async () => {
                if (!checkRustAnalyzerInstalled()) {
                    vscode.window.showErrorMessage(
                        'rust-analyzer is not installed. Please install it from https://rust-analyzer.github.io/manual.html#rust-analyzer-language-server-binary'
                    );
                    return;
                }
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
                runCommand(
                    'rust-analyzer',
                    ['diagnostics', projectDir],
                    outputChannel,
                    projectDir,
                    'rust-analyzer',
                    (success) => {
                        if (success) {
                            cp.exec(
                                `rust-analyzer diagnostics ${projectDir}`,
                                { cwd: projectDir },
                                (error, stdout, stderr) => {
                                    if (error) {
                                        vscode.window.showErrorMessage('Rust Analyzer failed');
                                    } else {
                                        const errors = parseRustAnalyzerOutput(stdout);
                                        displayDiagnostics(errors, outputChannel);
                                    }
                                }
                            );
                        }
                    }
                );
            }
        },
        {
            command: 'extension.showQuickPick',
            callback: async () => {
                const items: vscode.QuickPickItem[] = [
                    { label: 'Run cargo fmt', description: 'Format Rust code' },
                    { label: 'Run cargo clippy', description: 'Lint Rust code' },
                    { label: 'Run cargo test', description: 'Run Rust tests' },
                    { label: 'Run cargo check', description: 'Check Rust code' },
                    { label: 'Run cargo build', description: 'Build Rust code' },
                    { label: 'Run cargo doc', description: 'Generate documentation for Rust code' },
                    { label: 'Run cargo clean', description: 'Clean Rust project' },
                    { label: 'Run cargo run', description: 'Run Rust code' },
                    { label: 'Run cargo bench', description: 'Benchmark Rust code' },
                    { label: 'Run cargo fix', description: 'Fix Rust code' },
                    { label: 'Run rust-analyzer diagnostics', description: 'Run Rust Analyzer diagnostics' },
                    { label: 'Show Workspace Diagnostics Summary', description: 'Run diagnostics across the entire workspace and show a summary' }
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
                    case 'Run cargo doc':
                        vscode.commands.executeCommand('extension.rustDoc');
                        break;
                    case 'Run cargo clean':
                        vscode.commands.executeCommand('extension.rustClean');
                        break;
                    case 'Run cargo run':
                        vscode.commands.executeCommand('extension.rustRun');
                        break;
                    case 'Run cargo bench':
                        vscode.commands.executeCommand('extension.rustBench');
                        break;
                    case 'Run cargo fix':
                        vscode.commands.executeCommand('extension.rustFix');
                        break;
                    case 'Run rust-analyzer diagnostics':
                        vscode.commands.executeCommand('extension.rustAnalyzer');
                        break;
                    case 'Show Workspace Diagnostics Summary':
                        vscode.commands.executeCommand('extension.workspaceDiagnosticsSummary');
                        break;
                }
            }
        },
        {
            command: 'extension.workspaceDiagnosticsSummary',
            callback: async () => {
                const command = config.get<string>('diagnosticsCommand') || 'cargo check';
                await runWorkspaceDiagnostics(command);
            }
        }
    ];

    commands.forEach((command) => {
        const disposable = vscode.commands.registerCommand(command.command, command.callback);
        context.subscriptions.push(disposable);
    });

    // Real-time linting and formatting feedback
    vscode.workspace.onDidChangeTextDocument((event) => {
        const config = vscode.workspace.getConfiguration('rustFormatterLinter');
        if (config.get<boolean>('realTimeLinting')) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'rust') {
                const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
                if (!projectDir) {
                    vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                    return;
                }
                const args = ['--message-format=json', '--'];
                runCommand('cargo clippy', args, outputChannel, projectDir, 'cargo', (success) => {
                    if (success) {
                        cp.exec('cargo clippy --message-format=json', { cwd: projectDir }, (error, stdout, stderr) => {
                            if (error) {
                                vscode.window.showErrorMessage('Cargo Clippy failed');
                            } else {
                                const errors = parseClippyOutput(stdout);
                                displayDiagnostics(errors, outputChannel);
                            }
                        });
                    }
                });
            }
        }
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'rust') {
            const projectDir = findCargoTomlDir(document.uri.fsPath);
            if (!projectDir) {
                vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                return;
            }
            if (config.get<boolean>('formatOnSave')) {
                runCommand('cargo fmt', [], outputChannel, projectDir, 'cargo');
            }
            if (config.get<boolean>('testOnSave')) {
                runCommand('cargo test', [], outputChannel, projectDir, 'cargo');
            }
            if (config.get<boolean>('checkOnSave')) {
                runCommand('cargo check', [], outputChannel, projectDir, 'cargo');
            }
            if (config.get<boolean>('buildOnSave')) {
                runCommand('cargo build', [], outputChannel, projectDir, 'cargo');
            }
        }
    });

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'extension.showQuickPick';
    statusBarItem.text = '$(menu) Rust Actions';
    statusBarItem.tooltip = 'Show Rust commands';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    console.log('Rust Formatter and Linter Plus is now deactivated!');
}