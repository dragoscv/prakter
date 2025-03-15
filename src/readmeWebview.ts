import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { marked } from 'marked';

export class ReadmeWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prakter.readmePreview';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Watch for README changes
        if (vscode.workspace.workspaceFolders) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], 'README.md')
            );

            watcher.onDidChange(() => this.refresh());
            watcher.onDidCreate(() => this.refresh());
            watcher.onDidDelete(() => this.refresh());
        }
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        if (!vscode.workspace.workspaceFolders) {
            return this._getErrorHtml('No workspace folder found');
        }

        const readmePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'README.md');
        if (!fs.existsSync(readmePath)) {
            return this._getErrorHtml('README.md not found');
        }

        const content = fs.readFileSync(readmePath, 'utf-8');
        const html = marked(content);

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>README Preview</title>
                <style>
                    body {
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        padding: 0 20px;
                        line-height: 1.6;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                    pre {
                        padding: 16px;
                        overflow: auto;
                        font-size: 85%;
                        line-height: 1.45;
                        background-color: var(--vscode-editor-background);
                        border-radius: 3px;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                        padding: 0.2em 0.4em;
                        margin: 0;
                        font-size: 85%;
                        background-color: var(--vscode-editor-background);
                        border-radius: 3px;
                    }
                    blockquote {
                        padding: 0 1em;
                        color: var(--vscode-editor-foreground);
                        border-left: 0.25em solid var(--vscode-editor-lineHighlightBorder);
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>`;
    }

    private _getErrorHtml(message: string): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>README Preview</title>
                <style>
                    .error {
                        color: var(--vscode-errorForeground);
                        text-align: center;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="error">${message}</div>
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