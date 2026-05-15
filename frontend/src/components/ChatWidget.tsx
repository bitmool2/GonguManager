'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWidgetProps {
  slug: string;
  projectName?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3021';

function getVisitorId(): string {
  if (typeof window === 'undefined') return 'visitor';
  let id = localStorage.getItem('gongu_visitor_id');
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('gongu_visitor_id', id);
  }
  return id;
}

export default function ChatWidget({ slug, projectName }: ChatWidgetProps) {
  const [open,        setOpen]        = useState(false);
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [sessionId,   setSessionId]   = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const visitorId = useRef<string>('');

  useEffect(() => {
    visitorId.current = getVisitorId();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 첫 오픈 시 환영 메시지
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role:    'assistant',
        content: `안녕하세요! ${projectName ?? '공구'} 상담 도우미입니다 😊\n궁금한 점을 자유롭게 물어보세요.`,
      }]);
    }
  }, [open, messages.length, projectName]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/${slug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ visitorId: visitorId.current, message: text }),
      });

      if (!res.ok) throw new Error('응답 오류');
      const data: { reply: string; sessionId: number } = await res.json();
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        role:    'assistant',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, slug]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* 채팅창 */}
      {open && (
        <div className="w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden"
          style={{ height: '520px' }}>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">{projectName ?? '공구'} AI 상담</p>
                <p className="text-xs opacity-75">질문은 무엇이든 물어보세요</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary/80 h-8 w-8 p-0"
              onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                  ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-white border shadow-sm'}`}>
                  {msg.role === 'user'
                    ? <User className="h-3.5 w-3.5" />
                    : <Bot  className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-white border shadow-sm text-gray-800 rounded-tl-sm'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-white border shadow-sm flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-white border shadow-sm rounded-2xl rounded-tl-sm px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-3 py-2.5 bg-white border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="메시지 입력..."
              className="rounded-full text-sm"
              disabled={loading}
            />
            <Button size="sm" onClick={sendMessage} disabled={loading || !input.trim()}
              className="rounded-full h-9 w-9 p-0 flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <Button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full h-14 w-14 shadow-lg text-lg p-0"
        title="AI 상담"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}
