// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { marked } from 'marked';
import { ReadmeWebviewProvider } from './readmeWebview.js';
import { TodoWebviewProvider } from './todoWebview.js';
import { ChangelogWebviewProvider } from './changelogWebview.js';
import { WelcomeViewProvider } from './welcomeView.js';
import { CopilotIntegration } from './copilotIntegration.js';

// Declare providers at module level
let todoProvider: TodoTreeProvider;
let changelogProvider: ChangelogTreeProvider;

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
	// Register webview providers
	const readmeWebviewProvider = new ReadmeWebviewProvider(context.extensionUri);
	const welcomeViewProvider = new WelcomeViewProvider(context.extensionUri);
	const todoWebviewProvider = new TodoWebviewProvider(context.extensionUri);
	const changelogWebviewProvider = new ChangelogWebviewProvider(context.extensionUri);

	// Initialize providers
	todoProvider = new TodoTreeProvider(todoWebviewProvider);
	changelogProvider = new ChangelogTreeProvider(changelogWebviewProvider);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ReadmeWebviewProvider.viewType, readmeWebviewProvider),
		vscode.window.registerWebviewViewProvider(WelcomeViewProvider.viewType, welcomeViewProvider),
		vscode.window.registerWebviewViewProvider(TodoWebviewProvider.viewType, todoWebviewProvider),
		vscode.window.registerWebviewViewProvider(ChangelogWebviewProvider.viewType, changelogWebviewProvider)
	);

	// Register views with the initialized providers
	vscode.window.createTreeView('prakter.todoView', {
		treeDataProvider: todoProvider,
		showCollapseAll: true
	});

	vscode.window.createTreeView('prakter.changelogView', {
		treeDataProvider: changelogProvider,
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

	// Register task management commands
	let createTaskInCategory = vscode.commands.registerCommand('prakter.createTaskInCategory', async (category: TodoTreeItem) => {
		await addNewTodoItem(category.label);
		todoProvider.refresh();
		todoWebviewProvider.refresh(category.label);
	});

	let deleteTask = vscode.commands.registerCommand('prakter.deleteTask', async (task: TodoTreeItem) => {
		if (!task.todoItem) {
			return;
		}

		const answer = await vscode.window.showWarningMessage(
			`Are you sure you want to delete task "${task.todoItem.title}"?`,
			'Yes',
			'No'
		);

		if (answer === 'Yes') {
			await deleteExistingTask(task.todoItem);
			todoProvider.refresh();
			todoWebviewProvider.refresh(task.todoItem.category);
		}
	});

	let renameTask = vscode.commands.registerCommand('prakter.renameTask', async (task: TodoTreeItem) => {
		if (!task.todoItem) {
			return;
		}

		const newTitle = await vscode.window.showInputBox({
			prompt: 'Enter new task title',
			value: task.todoItem.title
		});

		if (newTitle) {
			await updateTaskTitle(task.todoItem, newTitle);
			todoProvider.refresh();
			todoWebviewProvider.refresh(task.todoItem.category);
		}
	});

	let viewTaskDetails = vscode.commands.registerCommand('prakter.viewTaskDetails', async (taskId: string) => {
		const task = await findTaskById(taskId);
		if (task) {
			const panel = vscode.window.createWebviewPanel(
				'taskDetails',
				`Task: ${task.title}`,
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			panel.webview.html = getTaskDetailsHtml(task);
		}
	});

	let viewTaskList = vscode.commands.registerCommand('prakter.viewTaskList', (category: TodoTreeItem) => {
		if (category.itemType === 'category') {
			todoWebviewProvider.refresh(category.label);
		}
	});

	context.subscriptions.push(
		createFiles,
		createFilesWithCopilot,
		addTodoItem,
		addChangelogItem,
		refreshView,
		createTaskInCategory,
		deleteTask,
		renameTask,
		viewTaskDetails,
		viewTaskList
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
		try {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				return [];
			}

			const readmePath = path.join(workspaceFolders[0].uri.fsPath, 'README.md');
			if (!fs.existsSync(readmePath)) {
				const item = new vscode.TreeItem('README.md not found. Create one?');
				item.command = {
					command: 'prakter.createFiles',
					title: 'Create README.md'
				};
				return [item];
			}

			const content = await fs.promises.readFile(readmePath, 'utf-8');
			const html = marked(content);
			const item = new vscode.TreeItem('README Preview');
			item.command = {
				command: 'markdown.showPreview',
				title: 'Preview README',
				arguments: [vscode.Uri.file(readmePath)]
			};
			return [item];
		} catch (error) {
			console.error('Error in ReadmeTreeProvider:', error);
			const errorItem = new vscode.TreeItem('Error reading README.md');
			errorItem.tooltip = error instanceof Error ? error.message : 'Unknown error';
			return [errorItem];
		}
	}
}

class ChangelogTreeProvider implements vscode.TreeDataProvider<ChangelogTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<ChangelogTreeItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private webviewProvider: ChangelogWebviewProvider) { }

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
		this.webviewProvider.refresh();
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
			const item = new ChangelogTreeItem('CHANGELOG.json not found. Create one?', '', [], 'message');
			item.command = {
				command: 'prakter.createFiles',
				title: 'Create CHANGELOG.json'
			};
			return [item];
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

	constructor(private webviewProvider: TodoWebviewProvider) { }

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
		this.webviewProvider.refresh();
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
			const item = new TodoTreeItem('TODO.json not found. Create one?', 'message');
			item.command = {
				command: 'prakter.createFiles',
				title: 'Create TODO.json'
			};
			return [item];
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

		// Add click handlers for categories and tasks
		if (itemType === 'category') {
			this.command = {
				command: 'prakter.viewTaskList',
				title: 'View Tasks',
				arguments: [this]
			};
		} else if (itemType === 'todo') {
			this.command = {
				command: 'prakter.viewTaskDetails',
				title: 'View Task Details',
				arguments: [todoItem?.id]
			};
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
	try {
		for (const [type, filePath] of Object.entries(files)) {
			let content = '';

			if (useCopilot) {
				content = await generateContentWithCopilot(type);
			} else {
				content = getDefaultContent(type);
			}

			await fs.promises.writeFile(filePath, content);
		}

		await vscode.window.showInformationMessage('Project files created successfully');
	} catch (error) {
		console.error('Error creating files:', error);
		throw error;
	}
}

async function createMissingFiles(files: Record<string, string>, useCopilot: boolean): Promise<void> {
	try {
		for (const [type, filePath] of Object.entries(files)) {
			if (!fs.existsSync(filePath)) {
				let content = '';

				if (useCopilot) {
					content = await generateContentWithCopilot(type);
				} else {
					content = getDefaultContent(type);
				}

				await fs.promises.writeFile(filePath, content);
			}
		}

		await vscode.window.showInformationMessage('Missing files created successfully');
	} catch (error) {
		console.error('Error creating missing files:', error);
		throw error;
	}
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

async function addNewTodoItem(selectedCategory?: string): Promise<void> {
	try {
		const title = await vscode.window.showInputBox({ prompt: 'Enter task title' });
		if (!title) {
			return;
		}

		const description = await vscode.window.showInputBox({ prompt: 'Enter task description' });
		if (!description) {
			return;
		}

		let category = selectedCategory;
		if (!category) {
			const categories = vscode.workspace.getConfiguration('prakter').get<string[]>('todoCategories') || [];
			const categoryItem = await vscode.window.showQuickPick(
				categories.map(c => ({ label: c })),
				{ placeHolder: 'Select category' }
			);
			if (!categoryItem) {
				return;
			}
			category = categoryItem.label;
		}

		const newItem: TodoItem = {
			id: Date.now().toString(),
			title,
			description,
			category,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			relatedFiles: []
		};

		const todoPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'TODO.json');
		let todos: TodoItem[] = [];

		if (fs.existsSync(todoPath)) {
			const content = await fs.promises.readFile(todoPath, 'utf-8');
			todos = JSON.parse(content);
		}

		todos.push(newItem);
		await fs.promises.writeFile(todoPath, JSON.stringify(todos, null, 2));
	} catch (error) {
		console.error('Error adding TODO item:', error);
		vscode.window.showErrorMessage('Failed to add TODO item');
		throw error;
	}
}

async function deleteExistingTask(task: TodoItem): Promise<void> {
	const todoPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'TODO.json');
	const content = await fs.promises.readFile(todoPath, 'utf-8');
	let todos: TodoItem[] = JSON.parse(content);

	todos = todos.filter(t => t.id !== task.id);
	await fs.promises.writeFile(todoPath, JSON.stringify(todos, null, 2));
}

async function updateTaskTitle(task: TodoItem, newTitle: string): Promise<void> {
	const todoPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'TODO.json');
	const content = await fs.promises.readFile(todoPath, 'utf-8');
	let todos: TodoItem[] = JSON.parse(content);

	const existingTask = todos.find(t => t.id === task.id);
	if (existingTask) {
		existingTask.title = newTitle;
		existingTask.updatedAt = new Date().toISOString();
		await fs.promises.writeFile(todoPath, JSON.stringify(todos, null, 2));
	}
}

async function findTaskById(taskId: string): Promise<TodoItem | undefined> {
	const todoPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'TODO.json');
	const content = await fs.promises.readFile(todoPath, 'utf-8');
	const todos: TodoItem[] = JSON.parse(content);
	return todos.find(t => t.id === taskId);
}

function getTaskDetailsHtml(task: TodoItem): string {
	return `<!DOCTYPE html>
	<html>
	<head>
		<style>
			body {
				padding: 20px;
				color: var(--vscode-foreground);
				font-family: var(--vscode-font-family);
			}
			.task-details {
				display: grid;
				gap: 15px;
			}
			.field {
				margin-bottom: 10px;
			}
			.field-label {
				font-weight: bold;
				color: var(--vscode-textPreformat-foreground);
			}
			.field-value {
				margin-top: 5px;
			}
			.related-files {
				margin-top: 10px;
			}
			.file-link {
				color: var(--vscode-textLink-foreground);
				text-decoration: none;
				display: block;
				margin: 5px 0;
			}
			.subtasks {
				margin-top: 15px;
			}
			.subtask-item {
				margin: 5px 0;
				padding-left: 20px;
			}
		</style>
	</head>
	<body>
		<div class="task-details">
			<h2>${task.title}</h2>
			
			<div class="field">
				<div class="field-label">Description:</div>
				<div class="field-value">${task.description}</div>
			</div>

			<div class="field">
				<div class="field-label">Category:</div>
				<div class="field-value">${task.category}</div>
			</div>

			<div class="field">
				<div class="field-label">Status:</div>
				<div class="field-value">${task.completedAt ? 'Completed' : 'In Progress'}</div>
			</div>

			<div class="field">
				<div class="field-label">Created:</div>
				<div class="field-value">${new Date(task.createdAt).toLocaleString()}</div>
			</div>

			${task.completedAt ? `
				<div class="field">
					<div class="field-label">Completed:</div>
					<div class="field-value">${new Date(task.completedAt).toLocaleString()}</div>
				</div>
			` : ''}

			${task.possibleSolution ? `
				<div class="field">
					<div class="field-label">Possible Solution:</div>
					<div class="field-value">${task.possibleSolution}</div>
				</div>
			` : ''}

			${task.relatedFiles.length > 0 ? `
				<div class="field">
					<div class="field-label">Related Files:</div>
					<div class="field-value related-files">
						${task.relatedFiles.map(file => `
							<a class="file-link" href="#">${file}</a>
						`).join('')}
					</div>
				</div>
			` : ''}

			${task.subTasks && task.subTasks.length > 0 ? `
				<div class="field">
					<div class="field-label">Subtasks:</div>
					<div class="field-value subtasks">
						${task.subTasks.map(subtask => `
							<div class="subtask-item">
								• ${subtask.title} ${subtask.completedAt ? '✅' : ''}
							</div>
						`).join('')}
					</div>
				</div>
			` : ''}
		</div>
	</body>
	</html>`;
}

async function addNewChangelogItem(): Promise<void> {
	try {
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
			const content = await fs.promises.readFile(changelogPath, 'utf-8');
			changelog = JSON.parse(content);
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

		await fs.promises.writeFile(changelogPath, JSON.stringify(changelog, null, 2));
	} catch (error) {
		console.error('Error adding changelog item:', error);
		vscode.window.showErrorMessage('Failed to add changelog item');
		throw error;
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }
