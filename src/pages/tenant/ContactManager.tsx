import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { useMessages, useSendMessage } from '@/queries/useShared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Send, Circle } from 'lucide-react';
import { formatRiyadhTime } from '@/lib/formatTime';

export function ContactManager() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { ui } = useUi();
  const isRtl = ui.language === 'ar';

  // Thread ID is the tenant's userId — unique per tenant
  const threadId = session?.userId ?? '';

  const { data: messages = [] } = useMessages(threadId);
  const { mutate: sendMessage, isPending } = useSendMessage();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !threadId) return;
    sendMessage({
      threadId,
      msg: {
        from: 'tenant',
        text: input.trim(),
        textEn: input.trim(),
      },
    });
    setInput('');
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <PageHeader title={t('contact')} subtitle={t('manager')} />

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Chat header */}
        <div className="px-5 py-3 border-b border-stone-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slateblue-100 flex items-center justify-center text-slateblue-600 font-serif font-semibold">
            {isRtl ? 'م' : 'M'}
          </div>
          <div>
            <p className="font-medium text-navy-800 text-sm">{isRtl ? 'مدير العقار' : 'Property Manager'}</p>
            <p className="text-xs text-success-500 flex items-center gap-1">
              <Circle className="w-2 h-2 fill-current" />
              {t('online')}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-stone-400 text-sm py-8">{t('noMessages')}</p>
          ) : (
            messages.map((msg) => {
              const isTenant = msg.from === 'tenant';
              const text = isRtl ? msg.text : msg.textEn;
              return (
                <div key={msg.id} className={`flex ${isTenant ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                    isTenant
                      ? 'bg-copper-500 text-white rounded-br-md'
                      : 'bg-stone-100 text-navy-800 rounded-bl-md'
                  }`}>
                    <p className="text-sm leading-relaxed">{text}</p>
                    <p className={`text-[10px] mt-1 ${isTenant ? 'text-copper-100' : 'text-stone-400'}`}>{formatRiyadhTime(msg.time, isRtl)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-stone-200 flex items-center gap-2">
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
      </Card>
    </div>
  );
}
