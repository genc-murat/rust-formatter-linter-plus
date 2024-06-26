import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import axios, { AxiosInstance } from 'axios';
import { RustError } from './types';

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
    const config = vscode.workspace.getConfiguration('rustCodePro');
    const enableClippyPedantic = config.get<boolean>('enableClippyPedantic') || false;

    if (config.get<boolean>('autoClearOutput')) {
        outputChannel.clear();
    }

    const timestamp = new Date().toLocaleString();
    outputChannel.appendLine(`\n[${timestamp}] Running: ${command} ${args.join(' ')} in ${cwd}`);
    commandStatusBarItem.text = `$(sync~spin) Running: ${command}`;
    commandStatusBarItem.tooltip = `Running: ${command} ${args.join(' ')} in ${cwd}`;

    if (command === 'cargo clippy' && enableClippyPedantic) {
        args.push('--', '-D', 'clippy::pedantic');
    }

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
            const message = `${command} failed with exit code ${code}`;
            vscode.window.showErrorMessage(message);
            updateCommandStatusBarItem(message, `Exit code: ${code}`, false);
            outputChannel.appendLine(`[${timestamp}] ${message}`);
        } else {
            const message = `${command} completed successfully.`;
            vscode.window.showInformationMessage(message);
            updateCommandStatusBarItem(message, `Successfully completed ${command}`, true);
            outputChannel.appendLine(`[${timestamp}] ${message}`);
        }
        if (onDone) {
            onDone(code === 0);
        }
    });

    proc.on('error', (err) => {
        const message = `Failed to start process: ${err.message}`;
        vscode.window.showErrorMessage(message);
        updateCommandStatusBarItem(`Failed to start ${command}`, err.message, false);
        outputChannel.appendLine(`[${timestamp}] ${message}`);
        outputChannel.appendLine(`[${timestamp}] Error stack: ${err.stack}`);
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

function checkCargoNextestInstalled(): boolean {
    try {
        cp.execSync('cargo nextest --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function checkCargoLlvmCovInstalled(): boolean {
    try {
        cp.execSync('cargo llvm-cov --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function checkTarpaulinInstalled(): boolean {
    try {
        cp.execSync('cargo tarpaulin --version', { stdio: 'ignore' });
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
    } else if (command === 'cargo test' || command === 'cargo nextest run') {
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

function parseDiagnosticsOutput(output: string): RustError[] {
    const errors: RustError[] = [];
    const diagnostics = JSON.parse(output);

    diagnostics.forEach((diag: any) => {
        const { code, message, range, severity } = diag;
        const filePath = diag.file;
        errors.push({
            filePath,
            line: range.start.line,
            column: range.start.character,
            severity: severity === 'error' ? 'Error' : 'Warning',
            message: `${code}: ${message}`
        });
    });

    return errors;
}

function mapSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
        case 'Error':
            return vscode.DiagnosticSeverity.Error;
        case 'Warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'Information':
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
        diagnostic.source = error.severity === 'Error' ? 'clippy' : 'rust-analyzer';
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
                `Line ${diagnostic.range.start.line + 1}, Column ${
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

function isPerformanceSuggestion(message: string): boolean {
    return message.includes('consider') || message.includes('optimize');
}

function isCommonPitfall(message: string): boolean {
    return message.includes('unnecessary') || message.includes('avoid');
}

function showDiagnosticsSummary(diagnostics: RustError[], performanceSuggestions: RustError[], commonPitfalls: RustError[]) {
    const panel = vscode.window.createWebviewPanel(
        'rustDiagnosticsSummary',
        'Rust Diagnostics Summary',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    const diagnosticsHtml = diagnostics.map((diagnostic) => {
        const severityClass = diagnostic.severity.toLowerCase();
        return `<tr class="${severityClass}">
                    <td>${diagnostic.filePath}</td>
                    <td>${diagnostic.line + 1}</td>
                    <td>${diagnostic.column + 1}</td>
                    <td>${diagnostic.severity}</td>
                    <td>${diagnostic.message}</td>
                </tr>`;
    }).join('');

    const performanceHtml = performanceSuggestions.map((suggestion) => {
        return `<tr>
                    <td>${suggestion.filePath}</td>
                    <td>${suggestion.line + 1}</td>
                    <td>${suggestion.column + 1}</td>
                    <td>${suggestion.severity}</td>
                    <td>${suggestion.message}</td>
                </tr>`;
    }).join('');

    const pitfallsHtml = commonPitfalls.map((pitfall) => {
        return `<tr>
                    <td>${pitfall.filePath}</td>
                    <td>${pitfall.line + 1}</td>
                    <td>${pitfall.column + 1}</td>
                    <td>${pitfall.severity}</td>
                    <td>${pitfall.message}</td>
                </tr>`;
    }).join('');

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
                    color: #F7EEDD;
                }
                th {
                    background-color: #008DDA;
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
            <h2>Performance Suggestions</h2>
            <table>
                <tr>
                    <th>File</th>
                    <th>Line</th>
                    <th>Column</th>
                    <th>Severity</th>
                    <th>Message</th>
                </tr>
                ${performanceHtml}
            </table>
            <h2>Common Pitfalls</h2>
            <table>
                <tr>
                    <th>File</th>
                    <th>Line</th>
                    <th>Column</th>
                    <th>Severity</th>
                    <th>Message</th>
                </tr>
                ${pitfallsHtml}
            </table>
        </body>
        </html>`;
}

async function runWorkspaceDiagnostics(command: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folders found.');
        return;
    }

    const allDiagnostics: RustError[] = [];
    const performanceSuggestions: RustError[] = [];
    const commonPitfalls: RustError[] = [];

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

        const args = ['clippy', '--message-format=json'];
        await new Promise<void>((resolve) => {
            runCommand('cargo', args, outputChannel, packageDir, 'cargo', (success) => {
                if (success) {
                    cp.exec(`cargo ${args.join(' ')}`, { cwd: packageDir }, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`cargo clippy failed`);
                            outputChannel.appendLine(`Error stack: ${error.stack}`);
                        } else {
                            const errors = parseClippyOutput(stdout);
                            allDiagnostics.push(...errors);

                            errors.forEach(error => {
                                if (isPerformanceSuggestion(error.message)) {
                                    performanceSuggestions.push(error);
                                } else if (isCommonPitfall(error.message)) {
                                    commonPitfalls.push(error);
                                }
                            });
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
    showDiagnosticsSummary(allDiagnostics, performanceSuggestions, commonPitfalls);
}

function parseClippyOutput(output: string): RustError[] {
    const errors: RustError[] = [];
    const lines = output.split('\n');

    lines.forEach(line => {
        try {
            const parsedLine = JSON.parse(line);
            if (parsedLine.reason === 'compiler-message' && parsedLine.message) {
                const message = parsedLine.message;
                const primarySpan = message.spans.find((span: any) => span.is_primary);

                if (primarySpan) {
                    const rustError: RustError = {
                        filePath: primarySpan.file_name,
                        line: primarySpan.line_start - 1,
                        column: primarySpan.column_start - 1,
                        severity: message.level,
                        message: message.rendered || message.message
                    };
                    errors.push(rustError);
                }
            }
        } catch (e) {
            outputChannel.appendLine(`Error parsing line: ${line}`);
            outputChannel.appendLine(`Exception: ${e}`);
        }
    });

    return errors;
}

async function installToolchain() {
    const toolchain = await vscode.window.showInputBox({
        prompt: 'Enter the toolchain to install (e.g., stable, nightly, 1.53.0)'
    });
    if (toolchain) {
        await runRustupCommand('toolchain install', [toolchain], `Installed Rust toolchain: ${toolchain}`);
    }
}

async function updateToolchain() {
    await runRustupCommand('update', [], 'Updated Rust toolchains');
}

async function switchToolchain() {
    const toolchain = await vscode.window.showInputBox({
        prompt: 'Enter the toolchain to switch to (e.g., stable, nightly, 1.53.0)'
    });
    if (toolchain) {
        await runRustupCommand('default', [toolchain], `Switched to Rust toolchain: ${toolchain}`);
    }
}

function createOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Rust Code Pro');
    }
    outputChannel.show(true);
}

async function runRustupCommand(command: string, args: string[], successMessage: string) {
    createOutputChannel();
    const fullCommand = `rustup ${command} ${args.join(' ')}`;
    outputChannel.appendLine(`Running: ${fullCommand}`);

    try {
        const { stdout, stderr } = await execPromise(fullCommand);
        outputChannel.appendLine(stdout);
        if (stderr) {
            outputChannel.appendLine(`stderr: ${stderr}`);
        }
        vscode.window.showInformationMessage(successMessage);
    } catch (error) {
        if (error instanceof Error) {
            outputChannel.appendLine(`Error: ${error.message}`);
            outputChannel.appendLine(`Error stack: ${error.stack}`);
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        } else {
            outputChannel.appendLine(`Unknown error: ${JSON.stringify(error)}`);
            vscode.window.showErrorMessage('Unknown error occurred.');
        }
    }
}

function execPromise(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        cp.exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

async function runCargoGenerate() {
    const templateUrl = await vscode.window.showInputBox({
        prompt: 'Enter the template URL or name',
        placeHolder: 'gh:user/repo or user/repo'
    });

    if (!templateUrl) {
        vscode.window.showErrorMessage('Template URL or name is required.');
        return;
    }

    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter the project name',
        placeHolder: 'my-new-project'
    });

    if (!projectName) {
        vscode.window.showErrorMessage('Project name is required.');
        return;
    }

    const targetDir = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        openLabel: 'Select target directory'
    });

    if (!targetDir || targetDir.length === 0) {
        vscode.window.showErrorMessage('Target directory is required.');
        return;
    }

    const cwd = targetDir[0].fsPath;

    const args = ['generate', '--git', templateUrl, '--name', projectName];

    runCommand('cargo', args, outputChannel, cwd, 'cargo-generate');
}

async function runRefactorSuggestions() {
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

    const output = await new Promise<string>((resolve) => {
        const outputData: string[] = [];
        runCommandRefactor('cargo', ['fix', '--allow-dirty', '--allow-staged', '--message-format=json'], projectDir, (success, data) => {
            outputData.push(data);
            resolve(outputData.join('\n'));
        });
    });

    const changes = parseCargoOutput(output);
    showRefactorSuggestionsInWebview(changes);
}

function runCommandRefactor(
    command: string,
    args: string[],
    cwd: string,
    onDone: (success: boolean, data: string) => void
) {
    const proc = cp.spawn(command, args, { shell: true, cwd: cwd });
    let output = '';

    proc.stdout.on('data', (data) => {
        output += data.toString();
    });

    proc.stderr.on('data', (data) => {
        output += data.toString();
    });

    proc.on('close', (code) => {
        onDone(code === 0, output);
    });

    proc.on('error', (err) => {
        vscode.window.showErrorMessage(`Failed to start process: ${err.message}`);
        outputChannel.appendLine(`[${new Date().toLocaleString()}] Error stack: ${err.stack}`);
    });
}

function showRefactorSuggestionsInWebview(changes: RustError[]) {
    const panel = vscode.window.createWebviewPanel(
        'rustRefactorSuggestions',
        'Rust Refactor Suggestions',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    const changesHtml = changes.map(change => `
        <li>
            <strong>${change.filePath}:${change.line + 1}:${change.column + 1}</strong><br>
            ${change.message}
        </li>`).join('');

    panel.webview.html = `
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                }
                ul {
                    list-style-type: none;
                    padding: 0;
                }
                li {
                    background: #008DDA;
                    margin: 5px 0;
                    padding: 10px;
                    border-radius: 5px;
                    color: #F7EEDD
                }
                strong {
                    color: #ACE2E1;
                }
            </style>
        </head>
        <body>
            <h1>Refactor Suggestions</h1>
            <ul>
                ${changesHtml}
            </ul>
        </body>
        </html>`;
}

function parseCargoOutput(output: string): RustError[] {
    const errors: RustError[] = [];
    const lines = output.split('\n');

    lines.forEach(line => {
        try {
            const parsedLine = JSON.parse(line);
            if (parsedLine.reason === 'compiler-message' && parsedLine.message && parsedLine.message.spans.length > 0) {
                const primarySpan = parsedLine.message.spans.find((span: any) => span.is_primary);
                if (primarySpan) {
                    const rustError: RustError = {
                        filePath: primarySpan.file_name,
                        line: primarySpan.line_start - 1,
                        column: primarySpan.column_start - 1,
                        severity: parsedLine.message.level,
                        message: parsedLine.message.rendered || parsedLine.message.message
                    };
                    errors.push(rustError);
                }
            }
        } catch (e) {
            outputChannel.appendLine(`Error parsing line: ${line}`);
            outputChannel.appendLine(`Exception: ${e}`);
        }
    });

    return errors;
}

function loadProfile(profileName: string) {
    const config = vscode.workspace.getConfiguration('rustCodePro');
    const profiles = config.get<{ [key: string]: any }>('profiles');
    const profile = profiles ? profiles[profileName] : null;

    if (profile) {
        Object.keys(profile).forEach(key => {
            config.update(key, profile[key], vscode.ConfigurationTarget.Global);
        });
        vscode.window.showInformationMessage(`Profile '${profileName}' applied.`);
    } else {
        vscode.window.showErrorMessage(`Profile '${profileName}' not found.`);
    }
}

async function switchProfile() {
    const config = vscode.workspace.getConfiguration('rustCodePro');
    const profiles = config.get<{ [key: string]: any }>('profiles');

    if (!profiles) {
        vscode.window.showErrorMessage('No profiles defined.');
        return;
    }

    const profileNames = Object.keys(profiles);
    const selectedProfile = await vscode.window.showQuickPick(profileNames, {
        placeHolder: 'Select a configuration profile'
    });

    if (selectedProfile) {
        loadProfile(selectedProfile);
    }
}

async function sendToPlayground() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }

    const code = editor.document.getText();
    const playgroundUrl = 'https://play.rust-lang.org/';

    try {
        const axiosInstance: AxiosInstance = axios.create();

        const response = await axiosInstance.post(playgroundUrl + 'meta/gist', {
            code: code,
            edition: '2021'
        });

        const gistId = response.data.id;
        const shareUrl = `${playgroundUrl}?gist=${gistId}`;
        vscode.window.showInformationMessage(`Code shared on Rust Playground: ${shareUrl}`, 'Open').then(selection => {
            if (selection === 'Open') {
                vscode.env.openExternal(vscode.Uri.parse(shareUrl));
            }
        });
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            vscode.window.showErrorMessage(`Failed to share code on Rust Playground: ${error.message}`);
            outputChannel.appendLine(`Error stack: ${error.stack}`);
        } else {
            vscode.window.showErrorMessage('An unknown error occurred.');
            outputChannel.appendLine(`Unknown error: ${JSON.stringify(error)}`);
        }
    }
}

async function manageProfiles() {
    const config = vscode.workspace.getConfiguration('rustCodePro');
    const profiles = config.get<{ [key: string]: any }>('profiles');
    const profileNames = profiles ? Object.keys(profiles) : [];

    const options: vscode.QuickPickItem[] = [
        { label: 'Create New Profile' },
        { label: 'Edit Profile' },
        { label: 'Delete Profile' }
    ];

    const selectedOption = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select a profile action'
    });

    if (selectedOption) {
        if (selectedOption.label === 'Create New Profile') {
            await createProfile();
        } else if (selectedOption.label === 'Delete Profile') {
            await deleteProfile();
        } else if (selectedOption.label === 'Edit Profile') {
            await editProfile();
        }
    }
}

async function createProfile() {
    const profileName = await vscode.window.showInputBox({
        prompt: 'Enter the new profile name'
    });

    if (profileName) {
        const config = vscode.workspace.getConfiguration('rustCodePro');
        const profiles = config.get<{ [key: string]: any }>('profiles') || {};

        if (profiles[profileName]) {
            vscode.window.showErrorMessage(`Profile '${profileName}' already exists.`);
            return;
        }

        const newProfile = await configureProfile();

        profiles[profileName] = newProfile;
        await config.update('profiles', profiles, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Profile '${profileName}' created.`);
    }
}

async function editProfile() {
    const config = vscode.workspace.getConfiguration('rustCodePro');
    const profiles = config.get<{ [key: string]: any }>('profiles') || {};
    const profileNames = Object.keys(profiles);

    if (profileNames.length === 0) {
        vscode.window.showErrorMessage('No profiles available to edit.');
        return;
    }

    const selectedProfile = await vscode.window.showQuickPick(profileNames, {
        placeHolder: 'Select a profile to edit'
    });

    if (!selectedProfile) {
        vscode.window.showErrorMessage('Profile selection is required.');
        return;
    }

    const confirm = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: `Are you sure you want to edit the profile '${selectedProfile}'?`
    });

    if (confirm !== 'Yes') {
        vscode.window.showInformationMessage(`Profile '${selectedProfile}' was not edited.`);
        return;
    }

    const updatedProfile = await configureProfile(profiles[selectedProfile]);

    profiles[selectedProfile] = updatedProfile;
    await config.update('profiles', profiles, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Profile '${selectedProfile}' updated.`);
}

async function deleteProfile() {
    const config = vscode.workspace.getConfiguration('rustCodePro');
    const profiles = config.get<{ [key: string]: any }>('profiles') || {};
    const profileNames = Object.keys(profiles);

    if (profileNames.length === 0) {
        vscode.window.showErrorMessage('No profiles available to delete.');
        return;
    }

    if (profileNames.length === 1) {
        vscode.window.showErrorMessage('Cannot delete the only profile available.');
        return;
    }

    const profileToDelete = await vscode.window.showQuickPick(profileNames, {
        placeHolder: 'Select a profile to delete'
    });

    if (!profileToDelete) {
        vscode.window.showErrorMessage('Profile selection is required.');
        return;
    }

    const confirm = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: `Are you sure you want to delete the profile '${profileToDelete}'?`
    });

    if (confirm !== 'Yes') {
        vscode.window.showInformationMessage(`Profile '${profileToDelete}' was not deleted.`);
        return;
    }

    delete profiles[profileToDelete];
    await config.update('profiles', profiles, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Profile '${profileToDelete}' deleted.`);
}

async function configureProfile(existingProfile?: { [key: string]: any }): Promise<{ [key: string]: any }> {
    const profile = existingProfile || {};

    const configKeys = [
        'enableClippyPedantic',
        'autoClearOutput',
        'realTimeLinting',
        'formatOnSave',
        'testOnSave',
        'checkOnSave',
        'buildOnSave',
        'outputChannelName'
    ];

    for (const key of configKeys) {
        const currentValue = profile[key] !== undefined ? profile[key] : vscode.workspace.getConfiguration('rustCodePro').get(key);
        const newValue = await vscode.window.showInputBox({
            prompt: `Set value for ${key}`,
            value: currentValue !== undefined ? currentValue.toString() : ''
        });

        if (newValue !== undefined) {
            if (typeof currentValue === 'boolean') {
                profile[key] = newValue.toLowerCase() === 'true';
            } else if (typeof currentValue === 'number') {
                profile[key] = parseFloat(newValue);
            } else {
                profile[key] = newValue;
            }
        }
    }

    return profile;
}

async function expandMacro() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const projectDir = findCargoTomlDir(filePath);
    if (!projectDir) {
        vscode.window.showErrorMessage('Cargo.toml not found in the project.');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showErrorMessage('No macro selected.');
        return;
    }

    const outputChannel = vscode.window.createOutputChannel('Macro Expansion');
    outputChannel.show(true);

    // Check if cargo expand is installed
    try {
        cp.execSync('cargo expand --version', { stdio: 'ignore' });
    } catch (error) {
        const installExpand = await vscode.window.showWarningMessage(
            'cargo expand is not installed. Do you want to install it using `cargo install cargo-expand`?',
            'Yes',
            'No'
        );
        if (installExpand === 'Yes') {
            try {
                await execPromise('cargo install cargo-expand');
                vscode.window.showInformationMessage('cargo expand installed successfully.');
            } catch (installError) {
                if (installError instanceof Error) {
                    vscode.window.showErrorMessage(`Failed to install cargo expand: ${installError.message}`);
                } else {
                    vscode.window.showErrorMessage('Failed to install cargo expand: Unknown error occurred.');
                }
                return;
            }
        } else {
            return;
        }
    }

    try {
        const { stdout, stderr } = await execPromiseExpand(`cargo expand`, projectDir);
        if (stderr) {
            outputChannel.appendLine(`stderr: ${stderr}`);
        }
        outputChannel.appendLine(stdout);

        const macroExpansion = stdout.includes(selectedText) ? stdout.split(selectedText)[1] : stdout;

        const panel = vscode.window.createWebviewPanel(
            'macroExpansion',
            'Macro Expansion',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    pre { background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>Macro Expansion</h1>
                <pre>${macroExpansion}</pre>
            </body>
            </html>`;
    } catch (error) {
        if (error instanceof Error) {
            outputChannel.appendLine(`Error: ${error.message}`);
            outputChannel.appendLine(`Error stack: ${error.stack}`);
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        } else {
            outputChannel.appendLine(`Unknown error: ${JSON.stringify(error)}`);
            vscode.window.showErrorMessage('Unknown error occurred.');
        }
    }
}


function execPromiseExpand(command: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        cp.exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Rust Code Pro is now active!');

    const config = vscode.workspace.getConfiguration('rustCodePro');
    const outputChannelName = config.get<string>('outputChannelName') || 'Rust Code Pro';
    outputChannel = vscode.window.createOutputChannel(outputChannelName);
    outputChannel.show(true);

    const terminal = vscode.window.createTerminal('Rust Commands');

    const commands = [
        {
            command: 'rustcodepro.rustFmt',
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
                runTerminalCommand('cargo fmt', args, terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustClippy',
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
                runTerminalCommand('cargo clippy', additionalArgs, terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustTest',
            callback: async () => {
                const testTool = await vscode.window.showQuickPick(['cargo test', 'cargo nextest run'], {
                    placeHolder: 'Select the test tool to use'
                });
                if (!testTool) {
                    vscode.window.showErrorMessage('No test tool selected.');
                    return;
                }

                if (testTool === 'cargo nextest run' && !checkCargoNextestInstalled()) {
                    const installNextest = await vscode.window.showWarningMessage(
                        'cargo nextest is not installed. Do you want to install it?',
                        'Yes',
                        'No'
                    );
                    if (installNextest === 'Yes') {
                        try {
                            await execPromise('curl -LsSf https://get.nexte.st/latest/linux | tar zxf - -C ${CARGO_HOME:-~/.cargo}/bin');
                            vscode.window.showInformationMessage('cargo nextest installed successfully.');
                        } catch (error) {
                            if (error instanceof Error) {
                                vscode.window.showErrorMessage(`Failed to install cargo nextest: ${error.message}`);
                            } else {
                                vscode.window.showErrorMessage('Failed to install cargo nextest: Unknown error occurred.');
                            }
                            return;
                        }
                    } else {
                        return;
                    }
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
                const additionalArgs = await showAdditionalOptions(testTool);
                runTerminalCommand(testTool, additionalArgs, terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustCheck',
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
                runTerminalCommand('cargo check', [], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustBuild',
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
                runTerminalCommand('cargo build', additionalArgs, terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustDoc',
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
                runTerminalCommand('cargo doc', ['--open'], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustClean',
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
                runTerminalCommand('cargo clean', [], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustRun',
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
                runTerminalCommand('cargo run', additionalArgs, terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustBench',
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
                runTerminalCommand('cargo bench', additionalArgs, terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustFmtFile',
            callback: async (uri: vscode.Uri) => {
                const projectDir = findCargoTomlDir(uri.fsPath);
                if (!projectDir) {
                    vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                    return;
                }
                runTerminalCommand('cargo fmt --', [uri.fsPath], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustClippyFile',
            callback: async (uri: vscode.Uri) => {
                const projectDir = findCargoTomlDir(uri.fsPath);
                if (!projectDir) {
                    vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                    return;
                }
                runTerminalCommand('cargo clippy --', ['--', uri.fsPath], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.editRustfmtConfig',
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
            command: 'rustcodepro.editClippyConfig',
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
            command: 'rustcodepro.rustFix',
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
                runTerminalCommand('cargo fix', ['--allow-dirty', '--allow-staged'], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustAnalyzer',
            callback: async () => {
                if (!checkRustAnalyzerInstalled()) {
                    const installRustAnalyzer = await vscode.window.showWarningMessage(
                        'rust-analyzer is not installed. Do you want to install it using `rustup component add rust-analyzer`?',
                        'Yes',
                        'No'
                    );
                    if (installRustAnalyzer === 'Yes') {
                        try {
                            await execPromise('rustup component add rust-analyzer');
                            vscode.window.showInformationMessage('rust-analyzer installed successfully.');
                        } catch (error) {
                            if (error instanceof Error) {
                                vscode.window.showErrorMessage(`Failed to install rust-analyzer: ${error.message}`);
                            } else {
                                vscode.window.showErrorMessage('Failed to install rust-analyzer: Unknown error occurred.');
                            }
                            return;
                        }
                    } else {
                        return;
                    }
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
                runTerminalCommand('rust-analyzer diagnostics', [projectDir], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.manageCargoFeatures',
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

                await selectCargoFeatures(projectDir);
            }
        },
        {
            command: 'rustcodepro.installToolchain',
            callback: installToolchain
        },
        {
            command: 'rustcodepro.updateToolchain',
            callback: updateToolchain
        },
        {
            command: 'rustcodepro.switchToolchain',
            callback: switchToolchain
        },
        {
            command: 'rustcodepro.showQuickPick',
            callback: async () => {
                const buildCommands: vscode.QuickPickItem[] = [
                    { label: 'Run cargo fmt', description: 'Format Rust code' },
                    { label: 'Run cargo clippy', description: 'Lint Rust code' },
                    { label: 'Run Tests', description: 'Run Rust tests' },
                    { label: 'Run cargo check', description: 'Check Rust code' },
                    { label: 'Run cargo build', description: 'Build Rust code' },
                    { label: 'Run cargo doc', description: 'Generate documentation for Rust code' },
                    { label: 'Run cargo clean', description: 'Clean Rust project' },
                    { label: 'Run cargo run', description: 'Run Rust code' },
                    { label: 'Run cargo bench', description: 'Benchmark Rust code' },
                    { label: 'Run cargo fix', description: 'Fix Rust code' },
                    { label: 'Run rust-analyzer diagnostics', description: 'Run Rust Analyzer diagnostics' },
                    { label: '---', kind: vscode.QuickPickItemKind.Separator },
                    { label: '$(arrow-left) Go Back', description: 'Return to command categories' }
                ];

                const projectManagementCommands: vscode.QuickPickItem[] = [
                    { label: 'Install Rust Toolchain', description: 'Install a specific Rust toolchain' },
                    { label: 'Update Rust Toolchains', description: 'Update all Rust toolchains' },
                    { label: 'Switch Rust Toolchain', description: 'Switch to a specific Rust toolchain' },
                    { label: 'Run cargo-generate', description: 'Run cargo-generate to scaffold new projects' },
                    { label: 'Manage Cargo Features', description: 'Enable or disable specific Cargo features' },
                    { label: 'Send to Rust Playground', description: 'Send the current code to Rust Playground' },
                    { label: '---', kind: vscode.QuickPickItemKind.Separator },
                    { label: '$(arrow-left) Go Back', description: 'Return to command categories' }
                ];

                const diagnosticsCommands: vscode.QuickPickItem[] = [
                    { label: 'Show Workspace Diagnostics Summary', description: 'Run diagnostics across the entire workspace and show a summary' },
                    { label: 'Run refactor suggestions', description: 'Run cargo fix to apply suggested refactorings' },
                    { label: 'Switch Configuration Profile', description: 'Switch between different configuration profiles' },
                    { label: 'Manage Configuration Profiles', description: 'Create, edit, and delete configuration profiles' },
                    { label: '---', kind: vscode.QuickPickItemKind.Separator },
                    { label: '$(arrow-left) Go Back', description: 'Return to command categories' }
                ];

                const codeCoverageCommands: vscode.QuickPickItem[] = [
                    { label: 'Run cargo llvm-cov', description: 'Run code coverage with cargo llvm-cov' },
                    { label: 'Run cargo tarpaulin', description: 'Run code coverage with cargo tarpaulin' },
                    { label: '---', kind: vscode.QuickPickItemKind.Separator },
                    { label: '$(arrow-left) Go Back', description: 'Return to command categories' }
                ];

                const profileManagementCommands: vscode.QuickPickItem[] = [
                    { label: 'Create New Profile', description: 'Create a new configuration profile' },
                    { label: 'Edit Profile', description: 'Edit an existing configuration profile' },
                    { label: 'Delete Profile', description: 'Delete an existing configuration profile' },
                    { label: 'Switch Profile', description: 'Switch to a different configuration profile' },
                    { label: '---', kind: vscode.QuickPickItemKind.Separator },
                    { label: '$(arrow-left) Go Back', description: 'Return to command categories' }
                ];

                const commandCategories: { [key: string]: vscode.QuickPickItem[] } = {
                    'Build Commands': buildCommands,
                    'Project Management': projectManagementCommands,
                    'Diagnostics & Refactor': diagnosticsCommands,
                    'Code Coverage': codeCoverageCommands,
                    'Profile Management': profileManagementCommands
                };

                const items: vscode.QuickPickItem[] = [
                    { label: 'Build Commands', description: 'Commands related to building and running Rust code' },
                    { label: 'Project Management', description: 'Commands related to managing Rust projects' },
                    { label: 'Diagnostics & Refactor', description: 'Commands related to diagnostics and refactoring' },
                    { label: 'Code Coverage', description: 'Commands related to code coverage analysis' },
                    { label: 'Profile Management', description: 'Commands related to managing configuration profiles' }
                ];

                let selectedItem = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a Rust command category'
                });

                while (selectedItem) {
                    const commands = commandCategories[selectedItem.label];

                    const selectedCommand = await vscode.window.showQuickPick(commands, {
                        placeHolder: 'Select a Rust command'
                    });

                    if (!selectedCommand) {
                        return;
                    }

                    if (selectedCommand.label === '$(arrow-left) Go Back') {
                        selectedItem = await vscode.window.showQuickPick(items, {
                            placeHolder: 'Select a Rust command category'
                        });
                        continue;
                    }

                    switch (selectedCommand.label) {
                        case 'Run cargo fmt':
                            vscode.commands.executeCommand('rustcodepro.rustFmt');
                            break;
                        case 'Run cargo clippy':
                            vscode.commands.executeCommand('rustcodepro.rustClippy');
                            break;
                        case 'Run Tests':
                            vscode.commands.executeCommand('rustcodepro.rustTest');
                            break;
                        case 'Run cargo check':
                            vscode.commands.executeCommand('rustcodepro.rustCheck');
                            break;
                        case 'Run cargo build':
                            vscode.commands.executeCommand('rustcodepro.rustBuild');
                            break;
                        case 'Run cargo doc':
                            vscode.commands.executeCommand('rustcodepro.rustDoc');
                            break;
                        case 'Run cargo clean':
                            vscode.commands.executeCommand('rustcodepro.rustClean');
                            break;
                        case 'Run cargo run':
                            vscode.commands.executeCommand('rustcodepro.rustRun');
                            break;
                        case 'Run cargo bench':
                            vscode.commands.executeCommand('rustcodepro.rustBench');
                            break;
                        case 'Run cargo fix':
                            vscode.commands.executeCommand('rustcodepro.rustFix');
                            break;
                        case 'Run rust-analyzer diagnostics':
                            vscode.commands.executeCommand('rustcodepro.rustAnalyzer');
                            break;
                        case 'Show Workspace Diagnostics Summary':
                            vscode.commands.executeCommand('rustcodepro.workspaceDiagnosticsSummary');
                            break;
                        case 'Install Rust Toolchain':
                            vscode.commands.executeCommand('rustcodepro.installToolchain');
                            break;
                        case 'Update Rust Toolchains':
                            vscode.commands.executeCommand('rustcodepro.updateToolchain');
                            break;
                        case 'Switch Rust Toolchain':
                            vscode.commands.executeCommand('rustcodepro.switchToolchain');
                            break;
                        case 'Run cargo-generate':
                            vscode.commands.executeCommand('rustcodepro.cargoGenerate');
                            break;
                        case 'Run refactor suggestions':
                            vscode.commands.executeCommand('rustcodepro.runRefactorSuggestions');
                            break;
                        case 'Switch Configuration Profile':
                            vscode.commands.executeCommand('rustcodepro.switchProfile');
                            break;
                        case 'Manage Cargo Features':
                            vscode.commands.executeCommand('rustcodepro.manageCargoFeatures');
                            break;
                        case 'Send to Rust Playground':
                            vscode.commands.executeCommand('rustcodepro.sendToPlayground');
                            break;
                        case 'Manage Configuration Profiles':
                            vscode.commands.executeCommand('rustcodepro.manageProfiles');
                            break;
                        case 'Create New Profile':
                            vscode.commands.executeCommand('rustcodepro.createProfile');
                            break;
                        case 'Edit Profile':
                            vscode.commands.executeCommand('rustcodepro.editProfile');
                            break;
                        case 'Delete Profile':
                            vscode.commands.executeCommand('rustcodepro.deleteProfile');
                            break;
                        case 'Run cargo llvm-cov':
                            vscode.commands.executeCommand('rustcodepro.rustLlvmCov');
                            break;
                        case 'Run cargo tarpaulin':
                            vscode.commands.executeCommand('rustcodepro.rustTarpaulin');
                            break;
                        case 'Switch Profile':
                            vscode.commands.executeCommand('rustcodepro.switchProfile');
                            break;
                    }

                    return;
                }
            }
        },
        {
            command: 'rustcodepro.workspaceDiagnosticsSummary',
            callback: async () => {
                const command = config.get<string>('diagnosticsCommand') || 'cargo check';
                await runWorkspaceDiagnostics(command);
            }
        },
        {
            command: 'rustcodepro.cargoGenerate',
            callback: runCargoGenerate
        },
        {
            command: 'rustcodepro.runRefactorSuggestions',
            callback: runRefactorSuggestions
        },
        {
            command: 'rustcodepro.switchProfile',
            callback: switchProfile
        },
        {
            command: 'rustcodepro.sendToPlayground',
            callback: sendToPlayground
        },
        {
            command: 'rustcodepro.manageProfiles',
            callback: manageProfiles
        },
        {
            command: 'rustcodepro.createProfile',
            callback: createProfile
        },
        {
            command: 'rustcodepro.editProfile',
            callback: editProfile
        },
        {
            command: 'rustcodepro.deleteProfile',
            callback: deleteProfile
        },
        {
            command: 'rustcodepro.rustLlvmCov',
            callback: async () => {
                const toolInstalled = checkCargoLlvmCovInstalled();
                if (!toolInstalled) {
                    const installLlvmCov = await vscode.window.showWarningMessage(
                        'cargo-llvm-cov is not installed. Do you want to install it using `cargo install cargo-llvm-cov`?',
                        'Yes',
                        'No'
                    );
                    if (installLlvmCov === 'Yes') {
                        try {
                            await execPromise('cargo install cargo-llvm-cov');
                            vscode.window.showInformationMessage('cargo-llvm-cov installed successfully.');
                        } catch (error) {
                            if (error instanceof Error) {
                                vscode.window.showErrorMessage(`Failed to install cargo-llvm-cov: ${error.message}`);
                            } else {
                                vscode.window.showErrorMessage('Failed to install cargo-llvm-cov: Unknown error occurred.');
                            }
                            return;
                        }
                    } else {
                        return;
                    }
                }
                const testTool = await vscode.window.showQuickPick(['cargo test', 'cargo nextest run'], {
                    placeHolder: 'Select the test tool to use with cargo-llvm-cov'
                });
                if (!testTool) {
                    vscode.window.showErrorMessage('No test tool selected.');
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
                const additionalArgs = await showAdditionalOptions(testTool);
                const llvmCovCommand = testTool === 'cargo nextest run' ? 'cargo llvm-cov nextest' : 'cargo llvm-cov test';
                runTerminalCommand(llvmCovCommand, additionalArgs, terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.rustTarpaulin',
            callback: async () => {
                const toolInstalled = checkTarpaulinInstalled();
                if (!toolInstalled) {
                    const installTarpaulin = await vscode.window.showWarningMessage(
                        'cargo-tarpaulin is not installed. Do you want to install it using `cargo install cargo-tarpaulin`?',
                        'Yes',
                        'No'
                    );
                    if (installTarpaulin === 'Yes') {
                        try {
                            await execPromise('cargo install cargo-tarpaulin');
                            vscode.window.showInformationMessage('cargo-tarpaulin installed successfully.');
                        } catch (error) {
                            if (error instanceof Error) {
                                vscode.window.showErrorMessage(`Failed to install cargo-tarpaulin: ${error.message}`);
                            } else {
                                vscode.window.showErrorMessage('Failed to install cargo-tarpaulin: Unknown error occurred.');
                            }
                            return;
                        }
                    } else {
                        return;
                    }
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
                runTerminalCommand('cargo tarpaulin', [], terminal, projectDir);
            }
        },
        {
            command: 'rustcodepro.macroExpand',
            callback: expandMacro
        }
    ];

    commands.forEach((command) => {
        const disposable = vscode.commands.registerCommand(command.command, command.callback);
        context.subscriptions.push(disposable);
    });

    vscode.workspace.onDidChangeTextDocument((event) => {
        const config = vscode.workspace.getConfiguration('rustCodePro');
        if (config.get<boolean>('realTimeLinting')) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'rust') {
                const projectDir = findCargoTomlDir(editor.document.uri.fsPath);
                if (!projectDir) {
                    vscode.window.showErrorMessage('Cargo.toml not found in the project.');
                    return;
                }
                const args = ['--message-format=json', '--'];
                runTerminalCommand('cargo clippy', args, terminal, projectDir);
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
                runTerminalCommand('cargo fmt', [], terminal, projectDir);
            }
            if (config.get<boolean>('testOnSave')) {
                runTerminalCommand('cargo test', [], terminal, projectDir);
            }
            if (config.get<boolean>('checkOnSave')) {
                runTerminalCommand('cargo check', [], terminal, projectDir);
            }
            if (config.get<boolean>('buildOnSave')) {
                runTerminalCommand('cargo build', [], terminal, projectDir);
            }
        }
    });

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'rustcodepro.showQuickPick';
    statusBarItem.text = '$(code) Rust Tools';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    statusBarItem.tooltip = 'Rust Tools and Commands\n\n' +
                        'Access a variety of tools and commands to assist with your Rust development.\n\n' +
                        '- Format code\n' +
                        '- Lint code\n' +
                        '- Run tests\n' +
                        '- Build projects\n' +
                        '- Generate documentation\n' +
                        '- Manage Rust toolchains\n' +
                        '- Send code to Rust Playground\n' +
                        'and much more!';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

function runTerminalCommand(command: string, args: string[], terminal: vscode.Terminal, cwd: string) {
    terminal.sendText(`cd "${cwd}"`);
    terminal.sendText(`${command} ${args.join(' ')}`);
    terminal.show();
}

function getCargoFeatures(cargoTomlPath: string): string[] {
    if (!fs.existsSync(cargoTomlPath)) {
        return [];
    }

    const content = fs.readFileSync(cargoTomlPath, 'utf8');
    const cargoToml = toml.parse(content);

    if (cargoToml.features) {
        return Object.keys(cargoToml.features);
    }

    return [];
}

async function selectCargoFeatures(projectDir: string) {
    const cargoTomlPath = path.join(projectDir, 'Cargo.toml');
    const features = getCargoFeatures(cargoTomlPath);

    if (features.length === 0) {
        vscode.window.showInformationMessage('No features found in Cargo.toml');
        return;
    }

    const selectedFeatures = await vscode.window.showQuickPick(features, {
        placeHolder: 'Select features to enable',
        canPickMany: true
    });

    if (selectedFeatures) {
        enableCargoFeatures(projectDir, selectedFeatures);
    }
}

function enableCargoFeatures(projectDir: string, features: string[]) {
    const args = ['build', '--features', features.join(',')];

    runCommand('cargo', args, outputChannel, projectDir, 'cargo', (success) => {
        if (success) {
            vscode.window.showInformationMessage(`Enabled features: ${features.join(', ')}`);
        } else {
            vscode.window.showErrorMessage('Failed to enable features');
        }
    });
}

export function deactivate() {
    console.log('Rust Code Pro is now deactivated!');
}
