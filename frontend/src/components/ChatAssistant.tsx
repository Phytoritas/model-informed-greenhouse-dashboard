import { useState } from 'react';
import { X, Send, Bot } from 'lucide-react';
import type {
    SensorData,
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    RtrProfile,
    WeatherOutlook,
} from '../types';
import { API_URL } from '../config';
import { useLocale } from '../i18n/LocaleProvider';
import { buildAiDashboardContext } from '../utils/aiDashboardContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
    crop: CropType;
    forecast?: ForecastData | null;
    history?: SensorData[];
    weather?: WeatherOutlook | null;
    rtrProfile?: RtrProfile | null;
}

type ChatResponse = {
    detail?: string;
    message?: string;
    text?: string;
};

const ChatAssistant = ({
    isOpen,
    onClose,
    currentData,
    metrics,
    crop,
    forecast,
    history = [],
    weather = null,
    rtrProfile = null,
}: ChatAssistantProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            initialMessage: '안녕하세요! 온실 어시스턴트입니다. 현재 생육 상태나 제어 전략에 대해 물어보세요.',
            title: '어시스턴트',
            placeholder: '메시지를 입력하세요...',
            noResponse: '응답이 없습니다.',
            unknownError: '알 수 없는 오류가 발생했습니다.',
            aiUnavailable: 'AI 채팅을 사용할 수 없습니다',
        }
        : {
            initialMessage: "Hello! I'm your greenhouse assistant. Ask me anything about your crop status.",
            title: 'Assistant',
            placeholder: 'Type a message...',
            noResponse: 'No response.',
            unknownError: 'An unknown error occurred.',
            aiUnavailable: 'AI chat is unavailable',
        };
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
        { role: 'ai', text: copy.initialMessage }
    ]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput("");

        setIsSending(true);
        try {
            const cropKey = crop.toLowerCase();
            const reqMessages = [
                ...messages.map(m => ({
                    role: m.role === 'ai' ? 'assistant' : 'user',
                    content: m.text
                })),
                { role: 'user', content: userMsg }
            ];

            const res = await fetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crop: cropKey,
                    messages: reqMessages,
                    dashboard: buildAiDashboardContext({
                        currentData,
                        metrics,
                        crop,
                        history,
                        forecast,
                        weather,
                        rtrProfile,
                    }),
                    language: locale
                })
            });
            const raw = await res.text();
            let json: ChatResponse | null = null;
            try {
                json = raw ? JSON.parse(raw) as ChatResponse : null;
            } catch {
                json = null;
            }

            if (!res.ok) {
                const message = json?.detail ?? json?.message ?? raw ?? `HTTP ${res.status}`;
                throw new Error(message);
            }

            setMessages(prev => [...prev, { role: 'ai', text: json?.text || copy.noResponse }]);
        } catch (e) {
            const message =
                e instanceof Error ? e.message : copy.unknownError;
            setMessages(prev => [...prev, { role: 'ai', text: `${copy.aiUnavailable}: ${message}` }]);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-green-400" />
                    <span className="font-medium">{copy.title}</span>
                </div>
                <button onClick={onClose} className="hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-green-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                            }`}>
                            {msg.role === 'ai' ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h2: ({ ...props }) => <h2 className="text-sm font-semibold mt-2 mb-1 text-slate-900" {...props} />,
                                        h3: ({ ...props }) => <h3 className="text-xs font-semibold mt-2 mb-1 text-slate-900" {...props} />,
                                        p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                        ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                        ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                        li: ({ ...props }) => <li className="mb-0" {...props} />,
                                        strong: ({ ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                                        code: ({ ...props }) => <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-900" {...props} />,
                                    }}
                                >
                                    {msg.text}
                                </ReactMarkdown>
                            ) : (
                                msg.text
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !isSending && handleSend()}
                    placeholder={copy.placeholder}
                    className="flex-1 px-4 py-2 bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default ChatAssistant;
