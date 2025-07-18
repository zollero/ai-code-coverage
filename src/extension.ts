import * as vscode from 'vscode';
import { AICodeCoverageTreeProvider } from './treeProvider';
import { StatusBarManager } from './statusBar';
import { WorkspaceAnalyzer } from './workspaceAnalyzer';

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Code Coverage extension activated');

    // Initialize components
    const workspaceAnalyzer = new WorkspaceAnalyzer();
    const treeProvider = new AICodeCoverageTreeProvider();
    const statusBar = new StatusBarManager();

    // Register tree view
    const treeView = vscode.window.createTreeView('aiCodeCoverageView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });

    // Register commands
    const commands = [
        // Analyze project command
        vscode.commands.registerCommand('ai-code-coverage.analyzeProject', async () => {
            const analysis = await workspaceAnalyzer.analyzeWorkspace();
            if (analysis) {
                treeProvider.updateAnalysis(analysis);
                statusBar.updateForProject(analysis.analyzedFiles, analysis.overallAiPercentage);
                vscode.window.showInformationMessage(
                    `Project analysis completed! AI code ratio: ${analysis.overallAiPercentage}% (${analysis.analyzedFiles} files)`
                );
            }
        }),

        // Analyze current file command
        vscode.commands.registerCommand('ai-code-coverage.analyzeCurrentFile', async () => {
            const analysis = await workspaceAnalyzer.analyzeCurrentFile();
            if (analysis) {
                statusBar.updateForFile(analysis);
                vscode.window.showInformationMessage(
                    `Current file AI code ratio: ${analysis.aiPercentage}% (confidence: ${analysis.confidence}%)`
                );
            }
        }),

        // Show report command
        vscode.commands.registerCommand('ai-code-coverage.showReport', async () => {
            await workspaceAnalyzer.showReport();
        }),

        // Refresh analysis command
        vscode.commands.registerCommand('ai-code-coverage.refreshAnalysis', async () => {
            workspaceAnalyzer.clearCache();
            const analysis = await workspaceAnalyzer.analyzeWorkspace();
            if (analysis) {
                treeProvider.updateAnalysis(analysis);
                statusBar.updateForProject(analysis.analyzedFiles, analysis.overallAiPercentage);
            }
        })
    ];

    // Listen for file save events
    const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const config = vscode.workspace.getConfiguration('aiCodeCoverage');
        const autoAnalyze = config.get<boolean>('autoAnalyze', true);
        
        if (autoAnalyze && document.uri.scheme === 'file') {
            // Auto analyze saved file
            const analysis = await workspaceAnalyzer.analyzeCurrentFile();
            if (analysis) {
                statusBar.updateForFile(analysis);
            }
        }
    });

    // Listen for active editor changes
    const onActiveEditorListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor && editor.document.uri.scheme === 'file') {
            const filePath = editor.document.uri.fsPath;
            const cachedAnalysis = workspaceAnalyzer.getFileAnalysis(filePath);
            statusBar.updateForFile(cachedAnalysis);
        } else {
            statusBar.updateForFile(null);
        }
    });

    // Listen for configuration changes
    const onConfigListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('aiCodeCoverage.enableStatusBar')) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const filePath = activeEditor.document.uri.fsPath;
                const cachedAnalysis = workspaceAnalyzer.getFileAnalysis(filePath);
                statusBar.updateForFile(cachedAnalysis);
            }
        }
    });

    // 添加到订阅列表
    context.subscriptions.push(
        ...commands,
        treeView,
        statusBar,
        onSaveListener,
        onActiveEditorListener,
        onConfigListener
    );

    // 初始化状态栏
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
        const filePath = activeEditor.document.uri.fsPath;
        const cachedAnalysis = workspaceAnalyzer.getFileAnalysis(filePath);
        statusBar.updateForFile(cachedAnalysis);
    } else {
        statusBar.updateForFile(null);
    }

    // 显示欢迎消息
    vscode.window.showInformationMessage(
        'AI Code Coverage 已就绪！使用命令面板搜索 "AI代码" 开始分析',
        '立即分析项目'
    ).then(selection => {
        if (selection === '立即分析项目') {
            vscode.commands.executeCommand('ai-code-coverage.analyzeProject');
        }
    });
}

export function deactivate() {
    console.log('AI Code Coverage 扩展已停用');
}
