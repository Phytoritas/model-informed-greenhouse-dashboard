/**
 * NDJSON event stream for /advisor/chat.
 *
 * The endpoint answers with one JSON object per line. Chunk boundaries fall
 * wherever the network puts them, so a chunk can split a multi-byte character
 * or land mid-line; both are buffered here rather than in the component.
 */

export type ChatStreamPhase = 'retrieving' | 'generating';

/** Authoritative final payload. Same shape the non-streaming response returns. */
export interface ChatStreamResponse {
    text?: string;
    follow_up?: unknown;
    status?: string;
    message?: string;
    /** Backend-side durations. Recorded, never rendered. */
    timings?: Record<string, unknown>;
    [key: string]: unknown;
}

export type ChatStreamEvent =
    | { type: 'status'; phase: ChatStreamPhase }
    | { type: 'delta'; text: string }
    | { type: 'done'; response: ChatStreamResponse }
    | { type: 'error'; message: string };

/**
 * A line that is not valid JSON means the answer text arriving on this stream
 * is already damaged, so it is raised instead of dropped: silently skipping it
 * would show the reader a plausible answer with a hole in the middle.
 */
export class ChatStreamParseError extends Error {
    constructor(readonly line: string) {
        super('The answer stream was interrupted.');
        this.name = 'ChatStreamParseError';
    }
}

const STREAM_MEDIA_TYPE = 'application/x-ndjson';

/** Accept header advertising the stream while leaving the JSON reply usable. */
export const CHAT_STREAM_ACCEPT = `${STREAM_MEDIA_TYPE}, application/json`;

/**
 * True when this response can actually be streamed. A backend without stream
 * support, or a test double without a body, falls through to the JSON path.
 */
export function isChatStreamResponse(response: {
    body?: unknown;
    headers?: { get?: (name: string) => string | null };
}): boolean {
    if (!response.body || typeof (response.body as ReadableStream).getReader !== 'function') {
        return false;
    }
    const contentType = typeof response.headers?.get === 'function'
        ? response.headers.get('content-type') ?? ''
        : '';
    return contentType.toLowerCase().includes('ndjson');
}

/**
 * Parses one NDJSON line. Blank lines and anything that is not a recognized
 * event type are ignored, so a keep-alive or a future event type cannot break
 * an answer that is otherwise arriving correctly. Malformed JSON is different:
 * it means text was lost, so it throws.
 */
export function parseChatStreamLine(line: string): ChatStreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        throw new ChatStreamParseError(trimmed);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ChatStreamParseError(trimmed);
    }

    const event = parsed as Record<string, unknown>;
    switch (event.type) {
        case 'status':
            return event.phase === 'retrieving' || event.phase === 'generating'
                ? { type: 'status', phase: event.phase }
                : null;
        case 'delta':
            // An empty delta is legal but carries nothing to append.
            return typeof event.text === 'string' && event.text.length > 0
                ? { type: 'delta', text: event.text }
                : null;
        case 'done':
            return event.response && typeof event.response === 'object' && !Array.isArray(event.response)
                ? { type: 'done', response: event.response as ChatStreamResponse }
                : null;
        case 'error':
            return { type: 'error', message: typeof event.message === 'string' ? event.message : '' };
        default:
            return null;
    }
}

/**
 * Reads the stream to completion, calling `onEvent` in arrival order.
 *
 * `TextDecoder` is kept across reads with `stream: true` so a UTF-8 sequence
 * split across chunks decodes correctly, and a partial trailing line stays in
 * the buffer until its newline arrives. Aborting the request rejects the
 * pending read, which propagates to the caller.
 */
export async function readChatStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finished = false;

    /** Returns true once a terminal event has been delivered. */
    const drain = (upToEnd: boolean): boolean => {
        for (;;) {
            const breakIndex = buffer.indexOf('\n');
            if (breakIndex === -1) break;
            const line = buffer.slice(0, breakIndex);
            buffer = buffer.slice(breakIndex + 1);
            const event = parseChatStreamLine(line);
            if (!event) continue;
            onEvent(event);
            if (event.type === 'done' || event.type === 'error') return true;
        }
        if (upToEnd && buffer.trim()) {
            const event = parseChatStreamLine(buffer);
            buffer = '';
            if (event) {
                onEvent(event);
                if (event.type === 'done' || event.type === 'error') return true;
            }
        }
        return false;
    };

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) buffer += decoder.decode(value, { stream: true });
            // Stop at the terminal event: a backend that holds the response open
            // afterwards must not delay a result the reader already has.
            if (drain(false)) {
                finished = true;
                break;
            }
        }
        if (!finished) {
            // Flush any bytes the decoder was holding, then the last unterminated line.
            buffer += decoder.decode();
            drain(true);
        }
    } finally {
        if (finished) {
            // Release the connection rather than draining bytes nobody reads.
            try {
                await reader.cancel();
            } catch {
                // Cancelling an already-closed stream is not an error.
            }
        }
        try {
            reader.releaseLock();
        } catch {
            // A cancelled or already-released reader needs no cleanup.
        }
    }
}
