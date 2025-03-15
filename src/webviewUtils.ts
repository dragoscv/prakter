import * as vscode from 'vscode';

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function getBaseWebviewHtml(webview: vscode.Webview, nonce: string, content: string): string {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            ${content}
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
            </script>
        </body>
        </html>`;
}