import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface TodoItem {
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

export async function findTaskById(taskId: string): Promise<TodoItem | undefined> {
    const todoPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'TODO.json');
    const content = await fs.promises.readFile(todoPath, 'utf-8');
    const todos: TodoItem[] = JSON.parse(content);
    return todos.find(t => t.id === taskId);
}