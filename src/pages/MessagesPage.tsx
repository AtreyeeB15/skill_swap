import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { ConversationItem, MessageItem } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';

export const MessagesPage: React.FC = () => {
  const { user, subscribeToMessages, showToast } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string>(searchParams.get('c') || '');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    setError('');
    try {
      const res = await apiFetch<{ conversations: ConversationItem[] }>('/api/conversations');
      setConversations(res.conversations);
      const paramId = searchParams.get('c');
      if (paramId) {
        setActiveId(paramId);
      } else if (!activeId && res.conversations.length > 0) {
        setActiveId(res.conversations[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingConvos(false);
    }
  }, [searchParams, activeId]);

  const loadMessages = useCallback(async (convoId: string) => {
    if (!convoId) return;
    setLoadingMsgs(true);
    try {
      const res = await apiFetch<{ messages: MessageItem[] }>(`/api/conversations/${convoId}/messages`);
      setMessages(res.messages);
      setConversations((prev) => prev.map((c) => (c.id === convoId ? { ...c, unread_count: 0 } : c)));
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoadingMsgs(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
    }
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    return subscribeToMessages((incoming) => {
      if (incoming.conversation_id === activeId) {
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === incoming.conversation_id
            ? {
                ...c,
                last_message: incoming.content,
                last_message_at: incoming.created_at,
                unread_count:
                  incoming.conversation_id !== activeId && incoming.sender_id !== user?.id
                    ? c.unread_count + 1
                    : c.unread_count,
              }
            : c
        )
      );
    });
  }, [activeId, subscribeToMessages, user?.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await apiFetch<{ message: MessageItem }>(`/api/conversations/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: draft.trim() }),
      });
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setDraft('');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const activeConvo = conversations.find((c) => c.id === activeId);

  if (loadingConvos) return <LoadingSkeleton rows={3} />;
  if (error) return <ErrorBanner message={error} onRetry={loadConversations} />;

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="w-6 h-6" />}
        title="No conversations yet"
        description="Open a chat from any connected peer's profile or accept an exchange request to start messaging."
        actionLabel="Explore Peers"
        onAction={() => navigate('/explore')}
      />
    );
  }

  return (
    <div className="rounded-xl bg-white border border-[#1B2A41]/12 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[540px] max-h-[75vh]">
      {/* Conversation List */}
      <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#1B2A41]/10 overflow-y-auto divide-y divide-[#1B2A41]/8">
        {conversations.map((c) => {
          const selected = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveId(c.id);
                setSearchParams({ c: c.id });
              }}
              className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors ${
                selected ? 'bg-[#F5F1E8]' : 'hover:bg-[#F5F1E8]/50'
              }`}
            >
              <Avatar name={c.peer_name} src={c.peer_avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#1B2A41] truncate">{c.peer_name}</span>
                  {c.unread_count > 0 && (
                    <span className="text-[11px] font-mono font-semibold text-[#F47735] tabular-nums">
                      {c.unread_count} new
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#1B2A41]/65 truncate mt-0.5">
                  {c.last_message || 'No messages yet — say hello!'}
                </p>
              </div>
            </button>
          );
        })}
      </aside>

      {/* Active Thread */}
      <section className="md:col-span-8 flex flex-col min-h-[380px]">
        {activeConvo ? (
          <>
            <div className="px-5 py-3.5 border-b border-[#1B2A41]/10 flex items-center justify-between bg-[#F5F1E8]/35">
              <div className="flex items-center gap-3">
                <Avatar name={activeConvo.peer_name} src={activeConvo.peer_avatar} size="sm" />
                <div>
                  <h2 className="font-display font-semibold text-sm text-[#1B2A41]">{activeConvo.peer_name}</h2>
                  <p className="text-[11px] text-[#1B2A41]/60">Direct peer conversation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/peers/${activeConvo.peer_id}`)}
                className="text-xs font-medium text-[#2CA69A] hover:underline"
              >
                View Profile →
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F5F1E8]/25">
              {loadingMsgs ? (
                <LoadingSkeleton rows={2} />
              ) : messages.length === 0 ? (
                <p className="text-xs text-center text-[#1B2A41]/55 py-10">
                  Start the conversation with {activeConvo.peer_name}.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm ${
                          mine
                            ? 'bg-[#1B2A41] text-white'
                            : 'bg-white border border-[#1B2A41]/12 text-[#1B2A41]'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <p
                          className={`mt-1 text-[10px] font-mono tabular-nums ${
                            mine ? 'text-white/65' : 'text-[#1B2A41]/50'
                          }`}
                        >
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="p-3.5 border-t border-[#1B2A41]/10 bg-white flex items-center gap-2.5">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${activeConvo.peer_name}...`}
                className="flex-1 rounded-lg border border-[#1B2A41]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-[#1B2A41]/60">
            Select a conversation to view messages.
          </div>
        )}
      </section>
    </div>
  );
};
