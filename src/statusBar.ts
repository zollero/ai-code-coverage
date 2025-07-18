import * as vscode from 'vscode';
import { AICodeAnalysis } from './types';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.command = 'ai-code-coverage.analyzeCurrentFile';
        this.statusBarItem.tooltip = 'Click to analyze current file AI code coverage';
    }

    updateForFile(analysis: AICodeAnalysis | null): void {
        const config = vscode.workspace.getConfiguration('aiCodeCoverage');
        const enableStatusBar = config.get<boolean>('enableStatusBar', true);

        if (!enableStatusBar) {
            this.hide();
            return;
        }

        if (!analysis) {
            this.statusBarItem.text = '$(search) AI Code Analysis';
            this.statusBarItem.tooltip = 'Click to analyze current file';
            this.statusBarItem.backgroundColor = undefined;
        } else {
            const aiPercentage = analysis.aiPercentage;
            const icon = this.getIconForPercentage(aiPercentage);
            const color = this.getColorForPercentage(aiPercentage);
            
            this.statusBarItem.text = `${icon} AI: ${aiPercentage}%`;
            this.statusBarItem.tooltip = this.createTooltip(analysis);
            
            if (color) {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(color);
            } else {
                this.statusBarItem.backgroundColor = undefined;
            }
        }

        this.show();
    }

    updateForProject(totalFiles: number, aiPercentage: number): void {
        const config = vscode.workspace.getConfiguration('aiCodeCoverage');
        const enableStatusBar = config.get<boolean>('enableStatusBar', true);

        if (!enableStatusBar) {
            this.hide();
            return;
        }

        const icon = this.getIconForPercentage(aiPercentage);
        this.statusBarItem.text = `${icon} Project AI: ${aiPercentage}% (${totalFiles} files)`;
        this.statusBarItem.tooltip = `Project overall AI code coverage: ${aiPercentage}%\nAnalyzed ${totalFiles} files\nClick to view detailed report`;
        this.statusBarItem.command = 'ai-code-coverage.showReport';
        
        const color = this.getColorForPercentage(aiPercentage);
        if (color) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor(color);
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }

        this.show();
    }

    show(): void {
        this.statusBarItem.show();
    }

    hide(): void {
        this.statusBarItem.hide();
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }

    private getIconForPercentage(percentage: number): string {
        if (percentage >= 80) {
            return '$(robot)'; // 高AI比例
        } else if (percentage >= 50) {
            return '$(gear)'; // 中等AI比例
        } else if (percentage >= 20) {
            return '$(person)'; // 低AI比例
        } else {
            return '$(edit)'; // 主要是人工编写
        }
    }

    private getColorForPercentage(percentage: number): string | null {
        if (percentage >= 80) {
            return 'statusBarItem.errorBackground'; // 红色 - 高AI比例
        } else if (percentage >= 60) {
            return 'statusBarItem.warningBackground'; // 橙色 - 中高AI比例
        } else if (percentage >= 40) {
            return null; // 默认颜色 - 中等AI比例
        } else {
            return null; // 默认颜色 - 低AI比例
        }
    }

    private createTooltip(analysis: AICodeAnalysis): string {
        const confidence = analysis.confidence;
        const confidenceText = confidence >= 70 ? '高' : confidence >= 40 ? '中' : '低';
        
        return `AI代码分析结果:
━━━━━━━━━━━━━━━━━━━━
📊 AI生成代码: ${analysis.aiPercentage}% (${analysis.aiGeneratedLines} 行)
👤 人工编写: ${analysis.humanPercentage}% (${analysis.humanWrittenLines} 行)
📝 总代码行数: ${analysis.totalLines - analysis.emptyLines - analysis.commentLines} 行
🎯 置信度: ${confidence}% (${confidenceText})
🔍 检测模式: ${analysis.detectedPatterns.length} 个

${analysis.detectedPatterns.length > 0 ? 
    `检测到的AI模式:\n${analysis.detectedPatterns.slice(0, 3).map(p => `• ${p.description}`).join('\n')}` : 
    '未检测到明显的AI生成模式'
}

点击分析当前文件`;
    }
}
