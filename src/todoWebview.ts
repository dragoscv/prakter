import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getNonce, getBaseWebviewHtml } from './webviewUtils.js';

interface TodoItem {
    id: string;
    title: string;
    description: string;
    category: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    relatedFiles: string[];
    possibleSolution?: string;
    subTasks?: TodoItem[];
}

export class TodoWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prakter.todoView';
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
                    case 'editTask':
                        await vscode.commands.executeCommand('prakter.editTask', message.taskId);
                        break;
                    case 'viewTaskDetails':
                        await vscode.commands.executeCommand('prakter.viewTaskDetails', message.taskId);
                        break;
                }
            }
        );
    }

    public refresh(category?: string) {
        if (!this._view) {
            return;
        }

        const todoExists = this.checkTodoExists();
        this._view.webview.html = todoExists ?
            this._getTaskListHtml(this._view.webview, category) :
            this._getCreateButtonsHtml(this._view.webview);
    }

    private checkTodoExists(): boolean {
        if (!vscode.workspace.workspaceFolders) {
            return false;
        }

        const todoPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'TODO.json');
        return fs.existsSync(todoPath);
    }

    private _getTaskListHtml(webview: vscode.Webview, category?: string): string {
        const nonce = getNonce();
        let tasks: TodoItem[] = this.getTasks();

        if (category) {
            tasks = tasks.filter(task => task.category === category);
        }

        const tasksTable = tasks.length > 0 ? `
            <table class="task-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map(task => `
                        <tr>
                            <td class="task-title" onclick="viewTaskDetails('${task.id}')">${task.title}</td>
                            <td>${task.completedAt ? '✅' : '🔄'}</td>
                            <td>${new Date(task.createdAt).toLocaleDateString()}</td>
                            <td>
                                <button class="icon-button" onclick="editTask('${task.id}')" title="Edit">✏️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>` : '<p>No tasks found in this category</p>';

        const content = `
            <div class="container">
                ${category ? `<h2>${category}</h2>` : ''}
                ${tasksTable}
            </div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                function editTask(taskId) {
                    vscode.postMessage({ command: 'editTask', taskId });
                }
                
                function viewTaskDetails(taskId) {
                    vscode.postMessage({ command: 'viewTaskDetails', taskId });
                }
            </script>
            <style>
                .task-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                .task-table th,
                .task-table td {
                    padding: 8px;
                    text-align: left;
                    border-bottom: 1px solid var(--vscode-list-inactiveSelectionBackground);
                }
                .task-title {
                    cursor: pointer;
                }
                .task-title:hover {
                    color: var(--vscode-textLink-foreground);
                }
                .icon-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 2px 6px;
                }
                .icon-button:hover {
                    background: var(--vscode-list-hoverBackground);
                }
            </style>`;

        return getBaseWebviewHtml(webview, nonce, content);
    }

    private getTasks(): TodoItem[] {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const todoPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'TODO.json');
        if (!fs.existsSync(todoPath)) {
            return [];
        }

        try {
            const content = fs.readFileSync(todoPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Error reading tasks:', error);
            return [];
        }
    }

    private _getCreateButtonsHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        const content = `
            <div class="container">
                <h2>Create TODO List</h2>
                <p class="description">Start by creating a TODO.json file to track your tasks</p>
                <button onclick="createFiles()">Create Basic TODO File</button>
                <button onclick="createFilesWithCopilot()">Create TODO with Copilot</button>
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