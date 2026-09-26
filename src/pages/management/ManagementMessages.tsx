import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useMessageThreads, useMessages, useSendMessage } from '@/queries/useShared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/PageStates';
import { Send, MessageSquare, User } from 'lucide-react';

// Derive a display name from the threadId (mock userId format: "mock-email@domain.com")
function displayName(threadId: string): string {
  return threadId.replace(/^mock-/, '');
}

function ChatPane({ threadId, isRtl }: { threadId: string; isRtl: boolean }) {
  const { t } = useTranslation();
  const { data: messages = [] } = useMessages(threadId);
  const { mutate: sendMessage, isPending } = useSendMessage();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage({
      threadId,
      msg: { from: 'manager', text: input.trim(), textEn: input.trim() },
    });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-5 py-3 border-b border-stone-200 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-copper-100 flex items-center justify-center">
          <User className="w-4 h-4 text-copper-600" />
        </div>
        <div>
          <p className="font-medium text-navy-800 text-sm">{displayName(threadId)}</p>
          <p className="text-xs text-stone-400">{isRtl ? 'مستأجر' : 'Resident'}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-stone-400 text-sm py-8">{t('noMessages')}</p>
        ) : (
          messages.map((msg) => {
            const isManager = msg.from === 'manager';
            const text = isRtl ? msg.text : msg.textEn;
            return (
              <div key={msg.id} className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                  isManager
                    ? 'bg-copper-500 text-white rounded-br-md'
                    : 'bg-stone-100 text-navy-800 rounded-bl-md'
                }`}>
                  <p className="text-sm leading-relaxed">{text}</p>
                  <p className={`text-[10px] mt-1 ${isManager ? 'text-copper-100' : 'text-stone-400'}`}>{msg.time}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-stone-200 flex items-center gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSend(); }}
          placeholder={t('typeMessage')}
          className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-copper-100 focus:border-copper-300 transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isPending}
          className="w-10 h-10 rounded-xl bg-copper-500 text-white flex items-center justify-center hover:bg-copper-600 disabled:opacity-50 transition-colors shrink-0"
        >
          <Send className={`w-5 h-5 ${isRtl ? 'rtl-flip' : ''}`} />
        </button>
      </div>
    </div>
  );
}

export function ManagementMessages() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const isRtl = ui.language === 'ar';

  const { data: threads = [], isLoading } = useMessageThreads();
  const [activeThread, setActiveThread] = useState<string | null>(null);

  // Auto-select first thread
  useEffect(() => {
    if (threads.length > 0 && !activeThread) {
      setActiveThread(threads[0].threadId);
    }
  }, [threads, activeThread]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={isRtl ? 'رسائل المستأجرين' : 'Resident Messages'}
        subtitle={isRtl ? `${threads.length} محادثة` : `${threads.length} conversation${threads.length !== 1 ? 's' : ''}`}
      />

      {threads.length === 0 ? (
        <Card>
          <div className="py-16 flex flex-col items-center gap-3 text-stone-400">
            <MessageSquare className="w-10 h-10" />
            <p className="text-sm">{isRtl ? 'لا توجد رسائل بعد' : 'No messages yet'}</p>
          </div>
        </Card>
      ) : (
        <div className="flex gap-4" style={{ height: 'calc(100vh - 14rem)' }}>
          {/* Thread list */}
          <div className="w-64 shrink-0 flex flex-col gap-1 overflow-y-auto">
            {threads.map(({ threadId, messages }) => {
              const last = messages[messages.length - 1];
              const unread = messages.filter((m) => m.from === 'tenant').length;
              const isActive = activeThread === threadId;
              return (
                <button
                  key={threadId}
                  onClick={() => setActiveThread(threadId)}
                  className={`w-full text-start px-4 py-3 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-copper-50 border-copper-200'
                      : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-stone-500" />
                    </div>
                    <p className="text-xs font-medium text-navy-800 truncate flex-1">{displayName(threadId)}</p>
                    {unread > 0 && (
                      <span className="w-4 h-4 rounded-full bg-copper-500 text-white text-[10px] flex items-center justify-center shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                  {last && (
                    <p className="text-[11px] text-stone-400 truncate ps-9">
                      {isRtl ? last.text : last.textEn}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Chat pane */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            {activeThread ? (
              <ChatPane threadId={activeThread} isRtl={isRtl} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
                {isRtl ? 'اختر محادثة' : 'Select a conversation'}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
