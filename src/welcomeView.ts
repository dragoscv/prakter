import * as vscode from 'vscode';

export class WelcomeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prakter.welcomeView';

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'createFiles':
                        await vscode.commands.executeCommand('prakter.createFiles');
                        break;
                    case 'createFilesWithCopilot':
                        await vscode.commands.executeCommand('prakter.createFilesWithCopilot');
                        break;
                }
            }
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to Prakter</title>
                <style>
                    body {
                        padding: 20px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .container {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    button {
                        width: 100%;
                        padding: 12px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 2px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: var(--vscode-font-family);
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    h2 {
                        margin-bottom: 15px;
                        font-weight: normal;
                    }
                    .description {
                        margin-bottom: 20px;
                        font-size: 0.9em;
                        opacity: 0.8;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Create Project Files</h2>
                    <p class="description">Start by creating the basic project structure files (README.md, TODO.json, and CHANGELOG.json)</p>
                    <button onclick="createFiles()">Create Basic Files</button>
                    <button onclick="createFilesWithCopilot()">Create Files with Copilot</button>
                </div>
                <script nonce="${nonce}">
                    function createFiles() {
                        vscode.postMessage({ command: 'createFiles' });
                    }
                    function createFilesWithCopilot() {
                        vscode.postMessage({ command: 'createFilesWithCopilot' });
                    }
                    const vscode = acquireVsCodeApi();
                </script>
            </body>
            </html>`;
    }

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}