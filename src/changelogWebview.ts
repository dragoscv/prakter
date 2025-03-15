import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getNonce, getBaseWebviewHtml } from './webviewUtils.js';

export class ChangelogWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prakter.changelogView';
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

        this.refresh();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'createFiles':
                        await vscode.commands.executeCommand('prakter.createFiles');
                        this.refresh();
                        break;
                    case 'createFilesWithCopilot':
                        await vscode.commands.executeCommand('prakter.createFilesWithCopilot');
                        this.refresh();
                        break;
                }
            }
        );
    }

    public refresh() {
        if (!this._view) {
            return;
        }

        const changelogExists = this.checkChangelogExists();
        this._view.webview.html = changelogExists ?
            this._getEmptyHtml(this._view.webview) :
            this._getCreateButtonsHtml(this._view.webview);
    }

    private checkChangelogExists(): boolean {
        if (!vscode.workspace.workspaceFolders) {
            return false;
        }

        const changelogPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'CHANGELOG.json');
        return fs.existsSync(changelogPath);
    }

    private _getCreateButtonsHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        const content = `
            <div class="container">
                <h2>Create Changelog</h2>
                <p class="description">Start by creating a CHANGELOG.json file to track your project changes</p>
                <button onclick="createFiles()">Create Basic Changelog</button>
                <button onclick="createFilesWithCopilot()">Create Changelog with Copilot</button>
            </div>
            <script nonce="${nonce}">
                function createFiles() {
                    vscode.postMessage({ command: 'createFiles' });
                }
                function createFilesWithCopilot() {
                    vscode.postMessage({ command: 'createFilesWithCopilot' });
                }
            </script>`;

        return getBaseWebviewHtml(webview, nonce, content);
    }

    private _getEmptyHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        return getBaseWebviewHtml(webview, nonce, '<div></div>');
    }
}