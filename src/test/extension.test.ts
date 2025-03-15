import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { CopilotIntegration } from '../copilotIntegration.js';
import { TodoTreeProvider, TodoTreeItem } from '../extension.js';
import { TestUtils } from './testUtils.js';
import { TodoWebviewProvider } from '../todoWebview.js';

const testWorkspaceFolder = path.join(__dirname, '../../src/test/testWorkspace');

suite('Prakter Extension Test Suite', () => {
	const timeout = 10000;
	let sandbox: sinon.SinonSandbox;

	setup(async function () {
		this.timeout(timeout);
		sandbox = sinon.createSandbox();

		// Create test workspace files
		await TestUtils.createTestWorkspace(testWorkspaceFolder);
		await TestUtils.createBaseFiles(testWorkspaceFolder);

		// Mock workspace folders
		sandbox.stub(vscode.workspace, 'workspaceFolders').value([{
			uri: vscode.Uri.file(testWorkspaceFolder),
			name: 'test-workspace',
			index: 0
		}]);

		// Mock workspace configuration
		sandbox.stub(vscode.workspace, 'getConfiguration').returns({
			get: (key: string) => {
				if (key === 'todoCategories') {
					return [
						'Very Highly Urgent',
						'Highly Important',
						'Medium Necessarily',
						'Low Priority',
						'Futures',
						'Ideas'
					];
				}
				if (key === 'syncSettings') {
					return true;
				}
				return undefined;
			},
			update: () => Promise.resolve()
		} as any);
	});

	teardown(async () => {
		sandbox.restore();
		await TestUtils.cleanupTestWorkspace(testWorkspaceFolder);
	});

	test('Add TODO Item', async function () {
		this.timeout(timeout);
		const inputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
		const quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');

		inputBoxStub.onFirstCall().resolves('Test Task');
		inputBoxStub.onSecondCall().resolves('Test Description');
		quickPickStub.resolves({ label: 'High Priority' });

		await vscode.commands.executeCommand('prakter.addTodoItem');

		const todoPath = path.join(testWorkspaceFolder, 'TODO.json');
		const todos = JSON.parse(fs.readFileSync(todoPath, 'utf-8'));

		assert.ok(Array.isArray(todos), 'TODO items should be an array');
		assert.ok(todos.length > 0, 'Should have at least one TODO item');
		assert.strictEqual(todos[0].title, 'Test Task');
		assert.strictEqual(todos[0].description, 'Test Description');
		assert.strictEqual(todos[0].category, 'High Priority');
	});

	test('Add Changelog Item', async function () {
		this.timeout(timeout);
		const inputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
		const quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');

		inputBoxStub.onFirstCall().resolves('1.0.0');
		quickPickStub.resolves({ label: 'feature' });
		inputBoxStub.onSecondCall().resolves('Test feature');

		await vscode.commands.executeCommand('prakter.addChangelogItem');

		// Wait for file operations to complete
		await new Promise(resolve => setTimeout(resolve, 100));

		const changelogPath = path.join(testWorkspaceFolder, 'CHANGELOG.json');
		const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'));

		assert.ok(Array.isArray(changelog), 'Changelog should be an array');
		const entry = changelog.find((item: { version: string }) => item.version === '1.0.0');
		assert.ok(entry, 'Should find changelog entry with version 1.0.0');
		assert.ok(entry.changes && Array.isArray(entry.changes), 'Entry should have changes array');
		const change = entry.changes.find((c: { type: string; description: string }) =>
			c.type === 'feature' && c.description === 'Test feature'
		);
		assert.ok(change, 'Should find matching change entry');
	});

	test('Tree View Provider', async function () {
		this.timeout(timeout);
		const todoWebviewProvider = new TodoWebviewProvider(vscode.Uri.file(__dirname));
		const provider = new TodoTreeProvider(todoWebviewProvider);
		const items = await provider.getChildren();

		assert.ok(Array.isArray(items));
		assert.ok(items.length > 0);
		assert.strictEqual(items[0].label, 'Very Highly Urgent');
	});

	test('Copilot Content Generation', async function () {
		this.timeout(timeout);
		const copilot = CopilotIntegration.getInstance();

		// Mock VS Code API calls
		const docStub = sandbox.stub(vscode.workspace, 'openTextDocument');
		const editorStub = sandbox.stub(vscode.window, 'showTextDocument');
		const cmdStub = sandbox.stub(vscode.commands, 'executeCommand');

		const mockDoc = {
			getText: () => '# Generated Content\n\nTest content.',
			uri: vscode.Uri.file(path.join(testWorkspaceFolder, 'temp.md')),
			fileName: path.join(testWorkspaceFolder, 'temp.md'),
			languageId: 'markdown',
			version: 1,
			isDirty: false,
			isClosed: false,
			save: () => Promise.resolve(true),
			lineCount: 3,
			lineAt: () => ({
				text: '# Generated Content',
				range: new vscode.Range(0, 0, 0, 17),
				lineNumber: 0,
				rangeIncludingLineBreak: new vscode.Range(0, 0, 0, 18),
				firstNonWhitespaceCharacterIndex: 0,
				isEmptyOrWhitespace: false
			}),
			eol: vscode.EndOfLine.LF
		} as any;

		docStub.resolves(mockDoc);
		editorStub.resolves({
			document: mockDoc,
			hide: () => Promise.resolve()
		} as any);

		const content = await copilot.generateContent('readme', 'Test project context');

		assert.ok(content.includes('Generated Content'));
		assert.ok(cmdStub.calledWith('editor.action.inlineSuggest.trigger'));
	});

	test('Project Analysis', async function () {
		this.timeout(timeout);
		const copilot = CopilotIntegration.getInstance();
		const context = await copilot.analyzeProject();

		assert.ok(context.includes('test-project'));
		assert.ok(context.includes('A test project'));
	});
});

suite('TodoTreeProvider Test Suite', () => {
	let provider: TodoTreeProvider;
	let todoWebviewProvider: TodoWebviewProvider;

	setup(() => {
		todoWebviewProvider = new TodoWebviewProvider(vscode.Uri.file(__dirname));
		provider = new TodoTreeProvider(todoWebviewProvider);
	});

	// ...rest of existing tests...
});
