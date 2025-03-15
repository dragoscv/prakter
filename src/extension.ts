// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { marked } from 'marked';
import { ReadmeWebviewProvider } from './readmeWebview';
import { CopilotIntegration } from './copilotIntegration';

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

interface ChangelogItem {
	version: string;
	date: string;
	changes: {
		type: string;
		description: string;
	}[];
	subEntries?: ChangelogItem[];
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Register webview provider for README preview
	const readmeWebviewProvider = new ReadmeWebviewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ReadmeWebviewProvider.viewType, readmeWebviewProvider)
	);

	// Create tree data providers
	const changelogProvider = new ChangelogTreeProvider();
	const todoProvider = new TodoTreeProvider();

	// Register views
	vscode.window.createTreeView('prakter.changelogView', {
		treeDataProvider: changelogProvider,
		showCollapseAll: true
	});

	vscode.window.createTreeView('prakter.todoView', {
		treeDataProvider: todoProvider,
		showCollapseAll: true
	});

	// Register commands
	let createFiles = vscode.commands.registerCommand('prakter.createFiles', async () => {
		await createProjectFiles(false);
	});

	let createFilesWithCopilot = vscode.commands.registerCommand('prakter.createFilesWithCopilot', async () => {
		await createProjectFiles(true);
	});

	let addTodoItem = vscode.commands.registerCommand('prakter.addTodoItem', async () => {
		await addNewTodoItem();
		todoProvider.refresh();
	});

	let addChangelogItem = vscode.commands.registerCommand('prakter.addChangelogItem', async () => {
		await addNewChangelogItem();
		changelogProvider.refresh();
	});

	let refreshView = vscode.commands.registerCommand('prakter.refreshView', () => {
		readmeWebviewProvider.refresh();
		changelogProvider.refresh();
		todoProvider.refresh();
	});

	context.subscriptions.push(
		createFiles,
		createFilesWithCopilot,
		addTodoItem,
		addChangelogItem,
		refreshView
	);
}

class ReadmeTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<vscode.TreeItem[]> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return [];
		}

		const readmePath = path.join(workspaceFolders[0].uri.fsPath, 'README.md');
		if (!fs.existsSync(readmePath)) {
			return [new vscode.TreeItem('README.md not found. Create one?')];
		}

		const content = fs.readFileSync(readmePath, 'utf-8');
		const html = marked(content);
		// Create a tree item that will open the README in a webview when clicked
		const item = new vscode.TreeItem('README Preview');
		item.command = {
			command: 'vscode.previewHtml',
			title: 'Preview README',
			arguments: [vscode.Uri.file(readmePath)]
		};
		return [item];
	}
}

class ChangelogTreeProvider implements vscode.TreeDataProvider<ChangelogTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<ChangelogTreeItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: ChangelogTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: ChangelogTreeItem): Promise<ChangelogTreeItem[]> {
		if (!vscode.workspace.workspaceFolders) {
			return [];
		}

		const changelogPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'CHANGELOG.json');
		if (!fs.existsSync(changelogPath)) {
			return [new ChangelogTreeItem('CHANGELOG.json not found. Create one?', '', [], 'message')];
		}

		try {
			const content = fs.readFileSync(changelogPath, 'utf-8');
			const changelog: ChangelogItem[] = JSON.parse(content);

			if (!element) {
				return changelog.map(item => new ChangelogTreeItem(
					item.version,
					item.date,
					item.changes,
					'version',
					item.subEntries
				));
			}

			if (element.subEntries) {
				return element.subEntries.map(item => new ChangelogTreeItem(
					item.version,
					item.date,
					item.changes,
					'version',
					item.subEntries
				));
			}

			return element.changes.map(change => new ChangelogTreeItem(
				change.description,
				'',
				[],
				change.type
			));
		} catch (error) {
			return [new ChangelogTreeItem('Error reading CHANGELOG.json', '', [], 'error')];
		}
	}
}

class ChangelogTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly date: string,
		public readonly changes: { type: string; description: string }[],
		public readonly itemType: string,
		public readonly subEntries?: ChangelogItem[]
	) {
		super(
			itemType === 'version' ? `${label} (${date})` : label,
			subEntries || changes.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
		);

		this.tooltip = this.label;
		this.iconPath = this.getIcon();
	}

	private getIcon(): { light: vscode.Uri; dark: vscode.Uri } | undefined {
		const iconName = this.itemType === 'feature' ? 'star' :
			this.itemType === 'fix' ? 'bug' :
				this.itemType === 'version' ? 'tag' : 'info';

		return {
			light: vscode.Uri.file(path.join(__filename, '..', '..', 'media', `${iconName}-light.svg`)),
			dark: vscode.Uri.file(path.join(__filename, '..', '..', 'media', `${iconName}-dark.svg`))
		};
	}
}

export class TodoTreeProvider implements vscode.TreeDataProvider<TodoTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<TodoTreeItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: TodoTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: TodoTreeItem): Promise<TodoTreeItem[]> {
		if (!vscode.workspace.workspaceFolders) {
			return [];
		}

		const todoPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'TODO.json');
		if (!fs.existsSync(todoPath)) {
			return [new TodoTreeItem('TODO.json not found. Create one?', 'message')];
		}

		try {
			const content = fs.readFileSync(todoPath, 'utf-8');
			const todos: TodoItem[] = JSON.parse(content);

			if (!element) {
				const categories = vscode.workspace.getConfiguration('prakter').get<string[]>('todoCategories') || [];
				return categories.map(category => new TodoTreeItem(category, 'category'));
			}

			if (element.contextValue === 'category') {
				return todos
					.filter(todo => todo.category === element.label)
					.map(todo => new TodoTreeItem(todo.title, 'todo', todo));
			}

			if (element.todoItem?.subTasks) {
				return element.todoItem.subTasks.map(task => new TodoTreeItem(task.title, 'subtask', task));
			}

			return [];
		} catch (error) {
			return [new TodoTreeItem('Error reading TODO.json', 'error')];
		}
	}
}

export class TodoTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly itemType: string,
		public readonly todoItem?: TodoItem
	) {
		super(
			label,
			(itemType === 'category' || (todoItem?.subTasks && todoItem.subTasks.length > 0))
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.None
		);

		this.contextValue = itemType;
		this.tooltip = this.getTooltip();
		this.iconPath = this.getIcon();

		if (todoItem) {
			this.description = `Created: ${new Date(todoItem.createdAt).toLocaleDateString()}`;
			if (todoItem.completedAt) {
				this.description += ` | Completed: ${new Date(todoItem.completedAt).toLocaleDateString()}`;
			}
		}
	}

	private getTooltip(): string {
		if (!this.todoItem) {
			return this.label;
		}

		return `${this.todoItem.title}\n\n${this.todoItem.description}${this.todoItem.possibleSolution ? `\n\nPossible Solution: ${this.todoItem.possibleSolution}` : ''
			}${this.todoItem.relatedFiles.length > 0 ? `\n\nRelated Files:\n${this.todoItem.relatedFiles.join('\n')}` : ''
			}`;
	}

	private getIcon(): { light: vscode.Uri; dark: vscode.Uri } | undefined {
		const iconName = this.itemType === 'category' ? 'folder' :
			this.itemType === 'todo' ? 'task' :
				this.itemType === 'subtask' ? 'subtask' : 'info';

		return {
			light: vscode.Uri.file(path.join(__filename, '..', '..', 'media', `${iconName}-light.svg`)),
			dark: vscode.Uri.file(path.join(__filename, '..', '..', 'media', `${iconName}-dark.svg`))
		};
	}
}

async function createProjectFiles(useCopilot: boolean): Promise<void> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		vscode.window.showErrorMessage('No workspace folder found');
		return;
	}

	const rootPath = workspaceFolders[0].uri.fsPath;
	const files = {
		readme: path.join(rootPath, 'README.md'),
		changelog: path.join(rootPath, 'CHANGELOG.json'),
		todo: path.join(rootPath, 'TODO.json')
	};

	// Check existing files
	const existingFiles = Object.entries(files).filter(([_, path]) => fs.existsSync(path));

	if (existingFiles.length > 0) {
		const choice = await vscode.window.showWarningMessage(
			'Some files already exist. What would you like to do?',
			'Replace All',
			'Create Missing Only',
			'Cancel'
		);

		if (choice === 'Cancel') {
			return;
		}

		if (choice === 'Create Missing Only') {
			await createMissingFiles(files, useCopilot);
			return;
		}
	}

	await createAllFiles(files, useCopilot);
}

async function createAllFiles(files: Record<string, string>, useCopilot: boolean): Promise<void> {
	for (const [type, filePath] of Object.entries(files)) {
		let content = '';

		if (useCopilot) {
			// Here you would integrate with GitHub Copilot to generate content
			content = await generateContentWithCopilot(type);
		} else {
			content = getDefaultContent(type);
		}

		fs.writeFileSync(filePath, content);
	}

	vscode.window.showInformationMessage('Project files created successfully');
}

async function createMissingFiles(files: Record<string, string>, useCopilot: boolean): Promise<void> {
	for (const [type, filePath] of Object.entries(files)) {
		if (!fs.existsSync(filePath)) {
			let content = '';

			if (useCopilot) {
				content = await generateContentWithCopilot(type);
			} else {
				content = getDefaultContent(type);
			}

			fs.writeFileSync(filePath, content);
		}
	}

	vscode.window.showInformationMessage('Missing files created successfully');
}

function getDefaultContent(type: string): string {
	switch (type) {
		case 'readme':
			return '# Project Name\n\nProject description goes here.\n';
		case 'changelog':
			return JSON.stringify([{
				version: '0.1.0',
				date: new Date().toISOString().split('T')[0],
				changes: [
					{
						type: 'feature',
						description: 'Initial release'
					}
				]
			}], null, 2);
		case 'todo':
			return JSON.stringify([], null, 2);
		default:
			return '';
	}
}

async function generateContentWithCopilot(type: string): Promise<string> {
	const copilot = CopilotIntegration.getInstance();

	// Show progress indication
	const result = await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'Analyzing project and generating content with GitHub Copilot',
		cancellable: false
	}, async (progress) => {
		progress.report({ message: 'Analyzing project structure...' });
		const projectContext = await copilot.analyzeProject();

		progress.report({ message: 'Generating content...' });
		const content = await copilot.generateContent(type, projectContext);

		// Validate and format the content
		try {
			if (type !== 'readme') {
				// For JSON files, parse and stringify to ensure valid JSON
				return JSON.stringify(JSON.parse(content), null, 2);
			}
			return content;
		} catch (error) {
			console.error('Error parsing generated content:', error);
			return getDefaultContent(type);
		}
	});

	return result;
}

async function addNewTodoItem(): Promise<void> {
	const title = await vscode.window.showInputBox({ prompt: 'Enter task title' });
	if (!title) {
		return;
	}

	const description = await vscode.window.showInputBox({ prompt: 'Enter task description' });
	if (!description) {
		return;
	}

	const categories = vscode.workspace.getConfiguration('prakter').get<string[]>('todoCategories') || [];
	const categoryItem = await vscode.window.showQuickPick(
		categories.map(c => ({ label: c })),
		{ placeHolder: 'Select category' }
	);
	if (!categoryItem) {
		return;
	}

	const newItem: TodoItem = {
		id: Date.now().toString(),
		title,
		description,
		category: categoryItem.label,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		relatedFiles: []
	};

	const todoPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'TODO.json');
	let todos: TodoItem[] = [];

	if (fs.existsSync(todoPath)) {
		todos = JSON.parse(fs.readFileSync(todoPath, 'utf-8'));
	}

	todos.push(newItem);
	fs.writeFileSync(todoPath, JSON.stringify(todos, null, 2));
}

async function addNewChangelogItem(): Promise<void> {
	const version = await vscode.window.showInputBox({ prompt: 'Enter version number' });
	if (!version) {
		return;
	}

	const typeItem = await vscode.window.showQuickPick(
		['feature', 'fix', 'chore'].map(t => ({ label: t })),
		{ placeHolder: 'Select change type' }
	);
	if (!typeItem) {
		return;
	}

	const description = await vscode.window.showInputBox({ prompt: 'Enter change description' });
	if (!description) {
		return;
	}

	const newChange = {
		type: typeItem.label,
		description
	};

	const changelogPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'CHANGELOG.json');
	let changelog: ChangelogItem[] = [];

	if (fs.existsSync(changelogPath)) {
		changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'));
	}

	const existingVersion = changelog.find(item => item.version === version);
	if (existingVersion) {
		existingVersion.changes.push(newChange);
	} else {
		changelog.push({
			version,
			date: new Date().toISOString().split('T')[0],
			changes: [newChange]
		});
	}

	fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));
}

// This method is called when your extension is deactivated
export function deactivate() { }
