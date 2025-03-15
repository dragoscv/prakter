import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class TestUtils {
    static async createTestWorkspace(workspacePath: string): Promise<void> {
        if (!fs.existsSync(workspacePath)) {
            fs.mkdirSync(workspacePath, { recursive: true });
        }

        // Create .vscode directory
        const vscodePath = path.join(workspacePath, '.vscode');
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath, { recursive: true });
        }
    }

    static async cleanupTestWorkspace(workspacePath: string): Promise<void> {
        if (fs.existsSync(workspacePath)) {
            fs.rmSync(workspacePath, { recursive: true, force: true });
        }
    }

    static async createBaseFiles(workspacePath: string): Promise<void> {
        // Create README.md
        const readmePath = path.join(workspacePath, 'README.md');
        fs.writeFileSync(readmePath, '# Test Project\n\nThis is a test project.');

        // Create empty TODO.json
        const todoPath = path.join(workspacePath, 'TODO.json');
        fs.writeFileSync(todoPath, '[]');

        // Create CHANGELOG.json with initial version
        const changelogPath = path.join(workspacePath, 'CHANGELOG.json');
        const initialChangelog = [{
            version: '0.1.0',
            date: new Date().toISOString().split('T')[0],
            changes: [{
                type: 'feature',
                description: 'Initial test setup'
            }]
        }];
        fs.writeFileSync(changelogPath, JSON.stringify(initialChangelog, null, 2));

        // Create mock package.json for project analysis
        const packagePath = path.join(workspacePath, 'package.json');
        const mockPackage = {
            name: 'test-project',
            version: '1.0.0',
            description: 'A test project for Prakter extension',
            dependencies: {}
        };
        fs.writeFileSync(packagePath, JSON.stringify(mockPackage, null, 2));

        // Create workspace settings
        const settingsPath = path.join(workspacePath, '.vscode', 'settings.json');
        const settings = {
            'prakter.todoCategories': [
                'Very Highly Urgent',
                'Highly Important',
                'Medium Necessarily',
                'Low Priority',
                'Futures',
                'Ideas'
            ],
            'prakter.syncSettings': true
        };
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }

    static async createTodoItem(workspacePath: string, item: {
        title: string;
        description: string;
        category: string;
    }): Promise<void> {
        const todoPath = path.join(workspacePath, 'TODO.json');
        let todos = [];

        if (fs.existsSync(todoPath)) {
            todos = JSON.parse(fs.readFileSync(todoPath, 'utf-8'));
        }

        todos.push({
            id: Date.now().toString(),
            ...item,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            relatedFiles: []
        });

        fs.writeFileSync(todoPath, JSON.stringify(todos, null, 2));
    }

    static async createChangelogItem(workspacePath: string, item: {
        version: string;
        type: string;
        description: string;
    }): Promise<void> {
        const changelogPath = path.join(workspacePath, 'CHANGELOG.json');
        let changelog = [];

        if (fs.existsSync(changelogPath)) {
            changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'));
        }

        const existingVersion = changelog.find((v: { version: string }) => v.version === item.version);
        if (existingVersion) {
            existingVersion.changes.push({
                type: item.type,
                description: item.description
            });
        } else {
            changelog.push({
                version: item.version,
                date: new Date().toISOString().split('T')[0],
                changes: [{
                    type: item.type,
                    description: item.description
                }]
            });
        }

        fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));
    }

    static async openWorkspace(workspacePath: string): Promise<void> {
        const workspaceFile = path.join(workspacePath, 'test.code-workspace');
        const workspaceUri = vscode.Uri.file(workspaceFile);
        await vscode.commands.executeCommand('vscode.openFolder', workspaceUri);
    }

    static createMockQuickPickItem(label: string): vscode.QuickPickItem {
        return {
            label,
            picked: true,
            description: `Test ${label}`
        };
    }
}