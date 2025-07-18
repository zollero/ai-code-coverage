import * as vscode from 'vscode';
import { AICodeAnalyzer } from './analyzer';
import { ProjectAnalysis, AICodeAnalysis } from './types';

export class WorkspaceAnalyzer {
    private analyzer: AICodeAnalyzer;
    private currentAnalysis: ProjectAnalysis | null = null;
    private analysisCache: Map<string, AICodeAnalysis> = new Map();

    constructor() {
        this.analyzer = new AICodeAnalyzer();
    }

    async analyzeWorkspace(): Promise<ProjectAnalysis | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('没有打开的工作区');
            return null;
        }

        const workspaceFolder = workspaceFolders[0];
        const projectPath = workspaceFolder.uri.fsPath;

        try {
            // 显示进度
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AI代码覆盖率分析',
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0, message: '正在读取 .gitignore 并扫描项目文件...' });

                const analysis = await this.analyzer.analyzeProject(projectPath);
                
                if (token.isCancellationRequested) {
                    return null;
                }

                progress.report({ 
                    increment: 50, 
                    message: `正在分析 ${analysis.fileAnalyses.length} 个代码文件...` 
                });

                // 缓存文件分析结果
                for (const fileAnalysis of analysis.fileAnalyses) {
                    this.analysisCache.set(fileAnalysis.filePath, fileAnalysis);
                }

                progress.report({ increment: 100, message: '分析完成' });

                this.currentAnalysis = analysis;
                
                // 显示分析结果摘要
                vscode.window.showInformationMessage(
                    `分析完成！扫描了 ${analysis.analyzedFiles} 个文件，AI代码比例: ${analysis.overallAiPercentage}%`
                );
                
                return analysis;
            });
        } catch (error) {
            vscode.window.showErrorMessage(`分析失败: ${error}`);
            return null;
        }
    }

    async analyzeCurrentFile(): Promise<AICodeAnalysis | null> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('没有活动的编辑器');
            return null;
        }

        const filePath = activeEditor.document.uri.fsPath;
        
        // 检查缓存
        if (this.analysisCache.has(filePath)) {
            const cachedAnalysis = this.analysisCache.get(filePath)!;
            // 检查文件是否被修改（简单的时间戳检查）
            const document = activeEditor.document;
            if (!document.isDirty) {
                return cachedAnalysis;
            }
        }

        try {
            const analysis = await this.analyzer.analyzeFile(filePath);
            this.analysisCache.set(filePath, analysis);
            return analysis;
        } catch (error) {
            vscode.window.showErrorMessage(`分析当前文件失败: ${error}`);
            return null;
        }
    }

    getCurrentAnalysis(): ProjectAnalysis | null {
        return this.currentAnalysis;
    }

    getFileAnalysis(filePath: string): AICodeAnalysis | null {
        return this.analysisCache.get(filePath) || null;
    }

    clearCache(): void {
        this.analysisCache.clear();
        this.currentAnalysis = null;
    }

    async showReport(): Promise<void> {
        if (!this.currentAnalysis) {
            vscode.window.showInformationMessage('请先分析项目');
            return;
        }

        const analysis = this.currentAnalysis;
        
        // 创建报告面板
        const panel = vscode.window.createWebviewPanel(
            'aiCodeReport',
            'AI代码覆盖率报告',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.generateReportHTML(analysis);
    }

    private generateReportHTML(analysis: ProjectAnalysis): string {
        const topAIFiles = analysis.fileAnalyses
            .sort((a, b) => b.aiPercentage - a.aiPercentage)
            .slice(0, 10);

        const topHumanFiles = analysis.fileAnalyses
            .sort((a, b) => a.aiPercentage - b.aiPercentage)
            .slice(0, 10);

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI代码覆盖率报告</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            padding: 20px;
            border-radius: 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff6b6b, #ffa500, #32cd32);
            transition: width 0.3s ease;
        }
        .file-list {
            margin: 20px 0;
        }
        .file-item {
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
            background-color: var(--vscode-list-hoverBackground);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .file-name {
            font-family: monospace;
            flex-grow: 1;
        }
        .file-percentage {
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 12px;
            color: white;
        }
        .ai-high { background-color: #ff6b6b; }
        .ai-medium { background-color: #ffa500; }
        .ai-low { background-color: #32cd32; }
        .section {
            margin: 30px 0;
            padding: 20px;
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        h2 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI代码覆盖率分析报告</h1>
        <p>项目路径: ${analysis.projectPath}</p>
        <p>分析时间: ${analysis.timestamp.toLocaleString('zh-CN')}</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">${analysis.totalFiles}</div>
            <div>总文件数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${analysis.analyzedFiles}</div>
            <div>已分析文件</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${analysis.totalLines.toLocaleString()}</div>
            <div>总代码行数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${analysis.overallAiPercentage}%</div>
            <div>AI代码比例</div>
        </div>
    </div>

    <div class="section">
        <h2>📊 总体统计</h2>
        <div style="margin: 20px 0;">
            <div>AI生成代码: ${analysis.aiGeneratedLines.toLocaleString()} 行</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${analysis.overallAiPercentage}%; background: #ff6b6b;"></div>
            </div>
        </div>
        <div style="margin: 20px 0;">
            <div>人工编写代码: ${analysis.humanWrittenLines.toLocaleString()} 行</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${100 - analysis.overallAiPercentage}%; background: #32cd32;"></div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🔥 AI代码比例最高的文件</h2>
        <div class="file-list">
            ${topAIFiles.map(file => `
                <div class="file-item">
                    <span class="file-name">${this.getRelativePath(file.filePath, analysis.projectPath)}</span>
                    <span class="file-percentage ${this.getPercentageClass(file.aiPercentage)}">${file.aiPercentage}%</span>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <h2>✋ 人工编写比例最高的文件</h2>
        <div class="file-list">
            ${topHumanFiles.map(file => `
                <div class="file-item">
                    <span class="file-name">${this.getRelativePath(file.filePath, analysis.projectPath)}</span>
                    <span class="file-percentage ${this.getPercentageClass(file.aiPercentage)}">${file.aiPercentage}% AI</span>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
    }

    private getRelativePath(filePath: string, projectPath: string): string {
        return filePath.replace(projectPath, '').replace(/^[/\\]/, '');
    }

    private getPercentageClass(percentage: number): string {
        if (percentage >= 70) {
            return 'ai-high';
        }
        if (percentage >= 40) {
            return 'ai-medium';
        }
        return 'ai-low';
    }
}
