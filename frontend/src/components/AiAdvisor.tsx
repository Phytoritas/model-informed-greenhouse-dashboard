import { Sparkles, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiAdvisorProps {
    analysis: string;
    isLoading: boolean;
    onRefresh: () => void;
}

function extractExecutiveSummary(markdown: string): string {
    const text = (markdown || '').replace(/\r\n/g, '\n');
    const start = text.indexOf('## Executive Summary');
    if (start === -1) {
        return text.slice(0, 800);
    }
    const afterStart = text.slice(start);
    const next = afterStart.indexOf('\n## ', 5);
    if (next === -1) return afterStart;
    return afterStart.slice(0, next).trim();
}

const AiAdvisor = ({ analysis, isLoading, onRefresh }: AiAdvisorProps) => {
    const summary = analysis ? extractExecutiveSummary(analysis) : "";
    return (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    <h3 className="font-semibold">AI Advisor</h3>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors ${isLoading ? 'animate-spin' : ''}`}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-sm text-indigo-200">Analyzing data...</span>
                    </div>
                ) : (
                    <div className="text-sm leading-relaxed text-indigo-50 overflow-y-auto max-h-[240px]">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h2: ({ ...props }) => <h2 className="text-sm font-semibold mt-2 mb-1 text-white" {...props} />,
                                h3: ({ ...props }) => <h3 className="text-xs font-semibold mt-2 mb-1 text-white/90" {...props} />,
                                p: ({ ...props }) => <p className="mb-2" {...props} />,
                                ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                li: ({ ...props }) => <li className="mb-0" {...props} />,
                                strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                                code: ({ ...props }) => <code className="px-1 py-0.5 rounded bg-white/10 text-white" {...props} />,
                            }}
                        >
                            {summary || "System initializing. Waiting for sufficient data to generate insights..."}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiAdvisor;
