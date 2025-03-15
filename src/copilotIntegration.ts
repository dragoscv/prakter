import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CopilotIntegration {
    private static instance: CopilotIntegration;
    private constructor() { }

    static getInstance(): CopilotIntegration {
        if (!CopilotIntegration.instance) {
            CopilotIntegration.instance = new CopilotIntegration();
        }
        return CopilotIntegration.instance;
    }

    async generateContent(type: string, projectContext: string): Promise<string> {
        // Create a temporary file to get Copilot suggestions
        const tmpFile = await this.createTemporaryFile(type, projectContext);

        try {
            // Open the file to trigger Copilot
            const document = await vscode.workspace.openTextDocument(tmpFile);
            const editor = await vscode.window.showTextDocument(document);

            // Wait for Copilot to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Trigger Copilot inline suggestion
            await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');

            // Wait for suggestions
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Accept the suggestion if available
            await vscode.commands.executeCommand('editor.action.inlineSuggest.accept');

            // Get the generated content
            const content = editor.document.getText();

            // Close the temporary file
            await editor.hide();

            return content;
        } finally {
            // Clean up
            if (fs.existsSync(tmpFile)) {
                fs.unlinkSync(tmpFile);
            }
        }
    }

    private async createTemporaryFile(type: string, projectContext: string): Promise<string> {
        const tmpDir = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const fileName = `tmp_${type}_${Date.now()}.${type === 'readme' ? 'md' : 'json'}`;
        const filePath = path.join(tmpDir, fileName);

        // Create initial content to help Copilot understand the context
        const initialContent = this.getInitialContent(type, projectContext);
        fs.writeFileSync(filePath, initialContent);

        return filePath;
    }

    private getInitialContent(type: string, projectContext: string): string {
        switch (type) {
            case 'readme':
                return `# Project Documentation\n\n/* Please generate a comprehensive README for this project:\n${projectContext}\n*/\n`;
            case 'changelog':
                return `// Generate a CHANGELOG.json for this project with appropriate version entries:\n/*\nProject Context:\n${projectContext}\n*/\n{\n  "versions": [\n`;
            case 'todo':
                return `// Generate a TODO.json for this project with categorized tasks:\n/*\nProject Context:\n${projectContext}\n*/\n{\n  "tasks": [\n`;
            default:
                return '';
        }
    }

    async analyzeProject(): Promise<string> {
        if (!vscode.workspace.workspaceFolders) {
            return '';
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        let projectContext = '';

        try {
            // Read package.json for project info
            const packageJsonPath = path.join(rootPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                projectContext += `Project Name: ${packageJson.name}\n`;
                projectContext += `Description: ${packageJson.description}\n`;
                projectContext += `Dependencies: ${Object.keys(packageJson.dependencies || {}).join(', ')}\n`;
            }

            // Scan for common project files
            const files = fs.readdirSync(rootPath);
            projectContext += `\nProject Files:\n${files.join('\n')}\n`;

            // Look for source code files
            const srcPath = path.join(rootPath, 'src');
            if (fs.existsSync(srcPath)) {
                const srcFiles = this.walkDir(srcPath);
                projectContext += `\nSource Files:\n${srcFiles.join('\n')}\n`;
            }

            return projectContext;
        } catch (error) {
            console.error('Error analyzing project:', error);
            return '';
        }
    }

    private walkDir(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);

        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                results = results.concat(this.walkDir(filePath));
            } else {
                results.push(filePath);
            }
        }

        return results;
    }
}