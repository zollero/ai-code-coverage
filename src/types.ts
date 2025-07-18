export interface AICodeAnalysis {
    filePath: string;
    totalLines: number;
    aiGeneratedLines: number;
    humanWrittenLines: number;
    commentLines: number;
    emptyLines: number;
    aiPercentage: number;
    humanPercentage: number;
    confidence: number;
    detectedPatterns: AIPattern[];
}

export interface AIPattern {
    type: 'comment' | 'structure' | 'naming' | 'complexity';
    pattern: string;
    confidence: number;
    description: string;
    lineNumbers: number[];
}

export interface ProjectAnalysis {
    projectPath: string;
    totalFiles: number;
    analyzedFiles: number;
    totalLines: number;
    aiGeneratedLines: number;
    humanWrittenLines: number;
    overallAiPercentage: number;
    fileAnalyses: AICodeAnalysis[];
    timestamp: Date;
}

export interface AnalysisConfig {
    enableStatusBar: boolean;
    autoAnalyze: boolean;
    excludePatterns: string[];
    confidenceThreshold: number;
}

export interface TreeItemData {
    type: 'file' | 'folder' | 'summary';
    label: string;
    filePath?: string;
    aiPercentage?: number;
    totalLines?: number;
    children?: TreeItemData[];
}
