import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectAnalysis, AICodeAnalysis, TreeItemData } from './types';

export class AICodeCoverageTreeProvider implements vscode.TreeDataProvider<TreeItemData> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItemData | undefined | null | void> = new vscode.EventEmitter<TreeItemData | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItemData | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectAnalysis: ProjectAnalysis | null = null;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateAnalysis(analysis: ProjectAnalysis): void {
        this.projectAnalysis = analysis;
        this.refresh();
    }

    getTreeItem(element: TreeItemData): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label);

        if (element.type === 'summary') {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            treeItem.iconPath = new vscode.ThemeIcon('graph');
            treeItem.description = `${element.aiPercentage}% AI代码`;
        } else if (element.type === 'folder') {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.iconPath = vscode.ThemeIcon.Folder;
            treeItem.description = element.aiPercentage !== undefined ? `${element.aiPercentage}% AI` : '';
        } else if (element.type === 'file') {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.iconPath = vscode.ThemeIcon.File;
            treeItem.description = `${element.aiPercentage}% AI (${element.totalLines} 行)`;
            treeItem.tooltip = this.createFileTooltip(element);
            
            // 添加点击命令
            if (element.filePath) {
                treeItem.command = {
                    command: 'vscode.open',
                    title: '打开文件',
                    arguments: [vscode.Uri.file(element.filePath)]
                };
            }

            // 根据AI百分比设置图标颜色
            if (element.aiPercentage !== undefined) {
                if (element.aiPercentage > 70) {
                    treeItem.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('errorForeground'));
                } else if (element.aiPercentage > 40) {
                    treeItem.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('warningForeground'));
                } else {
                    treeItem.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('foreground'));
                }
            }
        }

        return treeItem;
    }

    getChildren(element?: TreeItemData): Thenable<TreeItemData[]> {
        if (!this.projectAnalysis) {
            return Promise.resolve([{
                type: 'summary',
                label: '点击"刷新分析"开始分析项目',
                aiPercentage: 0
            }]);
        }

        if (!element) {
            // 根节点
            const summary: TreeItemData = {
                type: 'summary',
                label: '项目概览',
                aiPercentage: this.projectAnalysis.overallAiPercentage,
                children: [
                    {
                        type: 'summary',
                        label: `总文件数: ${this.projectAnalysis.totalFiles}`,
                        aiPercentage: 0
                    },
                    {
                        type: 'summary',
                        label: `已分析: ${this.projectAnalysis.analyzedFiles}`,
                        aiPercentage: 0
                    },
                    {
                        type: 'summary',
                        label: `总代码行数: ${this.projectAnalysis.totalLines}`,
                        aiPercentage: 0
                    },
                    {
                        type: 'summary',
                        label: `AI生成: ${this.projectAnalysis.aiGeneratedLines} 行 (${this.projectAnalysis.overallAiPercentage}%)`,
                        aiPercentage: 0
                    },
                    {
                        type: 'summary',
                        label: `人工编写: ${this.projectAnalysis.humanWrittenLines} 行 (${100 - this.projectAnalysis.overallAiPercentage}%)`,
                        aiPercentage: 0
                    }
                ]
            };

            const fileTree = this.buildFileTree();
            return Promise.resolve([summary, ...fileTree]);
        }

        if (element.children) {
            return Promise.resolve(element.children);
        }

        return Promise.resolve([]);
    }

    private buildFileTree(): TreeItemData[] {
        if (!this.projectAnalysis) {
            return [];
        }

        const tree: { [key: string]: TreeItemData } = {};
        const rootPath = this.projectAnalysis.projectPath;

        // 构建文件夹结构
        for (const fileAnalysis of this.projectAnalysis.fileAnalyses) {
            const relativePath = path.relative(rootPath, fileAnalysis.filePath);
            const pathParts = relativePath.split(path.sep);
            
            let currentLevel = tree;
            let currentPath = '';

            // 处理文件夹
            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                currentPath = currentPath ? path.join(currentPath, part) : part;
                
                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        type: 'folder',
                        label: part,
                        children: [],
                        aiPercentage: 0,
                        totalLines: 0
                    };
                }
                
                if (!currentLevel[part].children) {
                    currentLevel[part].children = [];
                }
                
                currentLevel = currentLevel[part].children!.reduce((acc, child) => {
                    acc[child.label] = child;
                    return acc;
                }, {} as { [key: string]: TreeItemData });
            }

            // 添加文件
            const fileName = pathParts[pathParts.length - 1];
            currentLevel[fileName] = {
                type: 'file',
                label: fileName,
                filePath: fileAnalysis.filePath,
                aiPercentage: fileAnalysis.aiPercentage,
                totalLines: fileAnalysis.totalLines
            };
        }

        // 转换为数组并计算文件夹统计
        return this.convertTreeToArray(tree);
    }

    private convertTreeToArray(tree: { [key: string]: TreeItemData }): TreeItemData[] {
        const result: TreeItemData[] = [];

        for (const [key, item] of Object.entries(tree)) {
            if (item.type === 'folder' && item.children) {
                item.children = this.convertTreeToArray(
                    item.children.reduce((acc, child) => {
                        acc[child.label] = child;
                        return acc;
                    }, {} as { [key: string]: TreeItemData })
                );

                // 计算文件夹的AI百分比
                const folderStats = this.calculateFolderStats(item.children);
                item.aiPercentage = folderStats.aiPercentage;
                item.totalLines = folderStats.totalLines;
            }
            result.push(item);
        }

        // 按类型和名称排序
        return result.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.label.localeCompare(b.label);
        });
    }

    private calculateFolderStats(children: TreeItemData[]): { aiPercentage: number; totalLines: number } {
        let totalLines = 0;
        let totalAILines = 0;

        for (const child of children) {
            if (child.type === 'file') {
                totalLines += child.totalLines || 0;
                totalAILines += Math.round(((child.aiPercentage || 0) / 100) * (child.totalLines || 0));
            } else if (child.type === 'folder' && child.children) {
                const childStats = this.calculateFolderStats(child.children);
                totalLines += childStats.totalLines;
                totalAILines += Math.round((childStats.aiPercentage / 100) * childStats.totalLines);
            }
        }

        const aiPercentage = totalLines > 0 ? Math.round((totalAILines / totalLines) * 100) : 0;
        return { aiPercentage, totalLines };
    }

    private createFileTooltip(element: TreeItemData): string {
        if (!element.filePath || !this.projectAnalysis) {
            return '';
        }

        const analysis = this.projectAnalysis.fileAnalyses.find(a => a.filePath === element.filePath);
        if (!analysis) {
            return '';
        }

        return `文件: ${path.basename(analysis.filePath)}
总行数: ${analysis.totalLines}
AI生成: ${analysis.aiGeneratedLines} 行 (${analysis.aiPercentage}%)
人工编写: ${analysis.humanWrittenLines} 行 (${analysis.humanPercentage}%)
置信度: ${analysis.confidence}%
检测到的模式: ${analysis.detectedPatterns.length} 个`;
    }
}
