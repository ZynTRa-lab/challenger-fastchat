import { useState, useRef, useEffect } from 'react';
import { format, isToday, isYesterday, differenceInMinutes, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Smile, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#5865f2', '#eb459e', '#ed4245', '#faa61a',
  '#57f287', '#1abc9c', '#3498db', '#e91e63',
];

function getAvatarColor(username = '') {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(username = '') {
  return username.slice(0, 2).toUpperCase();
}

function formatDateSeparator(dateStr) {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Bugün';
  if (isYesterday(date)) return 'Dün';
  return format(date, 'd MMMM yyyy', { locale: tr });
}

function formatTimestamp(dateStr) {
  const date = parseISO(dateStr);
  return format(date, 'HH:mm');
}

function formatFullTimestamp(dateStr) {
  const date = parseISO(dateStr);
  return format(date, 'd MMM yyyy HH:mm', { locale: tr });
}

// ─── Markdown-like content renderer ─────────────────────────────────────────

function renderContent(content) {
  if (!content) return null;

  // Code blocks (```)
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'codeblock', value: match[1].trim() });
    lastIndex = codeBlockRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return parts.map((part, i) => {
    if (part.type === 'codeblock') {
      return (
        <pre key={i} className="bg-discord-darker rounded p-2 mt-1 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
          <code>{part.value}</code>
        </pre>
      );
    }

    // Inline formatting
    const inline = part.value;
    const segments = [];
    const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let m;

    while ((m = inlineRegex.exec(inline)) !== null) {
      if (m.index > last) segments.push(<span key={`t-${i}-${last}`}>{inline.slice(last, m.index)}</span>);
      if (m[2] !== undefined) segments.push(<strong key={`b-${i}-${m.index}`} className="font-bold">{m[2]}</strong>);
      else if (m[3] !== undefined) segments.push(<em key={`it-${i}-${m.index}`} className="italic">{m[3]}</em>);
      else if (m[4] !== undefined) segments.push(<code key={`c-${i}-${m.index}`} className="bg-discord-darker px-1 py-0.5 rounded text-sm font-mono">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < inline.length) segments.push(<span key={`t-${i}-end`}>{inline.slice(last)}</span>);

    return <span key={i}>{segments.length ? segments : inline}</span>;
  });
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ username, size = 10 }) {
  const color = getAvatarColor(username);
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none`}
      style={{ backgroundColor: color, minWidth: size === 10 ? '2.5rem' : '2rem', minHeight: size === 10 ? '2.5rem' : '2rem' }}
    >
      {getInitials(username)}
    </div>
  );
}

// ─── Emoji picker (simple) ───────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '✅', '👀'];

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-8 right-0 bg-discord-darker border border-discord-separator rounded-lg p-2 shadow-xl z-50 flex gap-1 flex-wrap w-40"
    >
      {QUICK_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="text-lg hover:bg-discord-hover rounded p-1 transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ─── Single Message ──────────────────────────────────────────────────────────

function Message({ message, isGrouped, setMessages }) {
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const editRef = useRef(null);

  const isOwn = message.author?.id === user?.id || message.author_id === user?.id;

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
    }
  }, [editing]);

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setEditing(false);
      return;
    }
    try {
      const data = await apiFetch(`/api/messages/${message.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent }),
      });
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, ...data.message } : m));
      setEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/messages/${message.id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== message.id));
      setShowDeleteConfirm(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReaction = async (emoji) => {
    const existing = message.reactions?.find(r => r.emoji === emoji);
    const userReacted = existing?.userIds?.includes(user?.id);
    try {
      if (userReacted) {
        const data = await apiFetch(`/api/messages/${message.id}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' });
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, reactions: data.reactions } : m));
      } else {
        const data = await apiFetch(`/api/messages/${message.id}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        });
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, reactions: data.reactions } : m));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setEditContent(message.content || '');
    }
  };

  const authorName = message.author?.username || 'Bilinmeyen';
  const timestamp = message.created_at;

  return (
    <div
      className={`relative group flex gap-3 px-4 py-0.5 hover:bg-discord-hover/30 rounded transition-colors ${!isGrouped ? 'mt-4 pt-2' : 'hover:bg-discord-hover/20'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar column */}
      <div className="w-10 flex-shrink-0">
        {!isGrouped ? (
          <Avatar username={authorName} size={10} />
        ) : (
          hovered && (
            <span className="text-[10px] text-discord-text-muted leading-10 select-none">
              {formatTimestamp(timestamp)}
            </span>
          )
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className="font-semibold text-discord-text hover:underline cursor-pointer"
              style={{ color: getAvatarColor(authorName) }}
            >
              {authorName}
            </span>
            <span className="text-xs text-discord-text-muted" title={formatFullTimestamp(timestamp)}>
              {formatFullTimestamp(timestamp)}
            </span>
            {message.updated_at && (
              <span className="text-[10px] text-discord-text-muted italic">(düzenlendi)</span>
            )}
          </div>
        )}

        {/* Message content */}
        {editing ? (
          <div className="mt-1">
            <textarea
              ref={editRef}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-discord-darker text-discord-text rounded p-2 text-sm resize-none outline-none border border-discord-brand focus:border-discord-brand"
              rows={Math.min(editContent.split('\n').length + 1, 10)}
            />
            <div className="flex items-center gap-2 mt-1 text-xs text-discord-text-muted">
              <span>Kaydet için <kbd className="bg-discord-hover px-1 rounded">Enter</kbd></span>
              <span>İptal için <kbd className="bg-discord-hover px-1 rounded">Escape</kbd></span>
            </div>
          </div>
        ) : (
          <div className="text-discord-text text-sm leading-relaxed break-words">
            {renderContent(message.content)}
          </div>
        )}

        {/* Attachments */}
        {message.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map((att, i) => {
              const isImage = att.match(/\.(png|jpg|jpeg|gif|webp)$/i);
              return isImage ? (
                <img
                  key={i}
                  src={att}
                  alt="attachment"
                  className="max-w-xs max-h-64 rounded object-contain bg-discord-darker"
                />
              ) : (
                <a
                  key={i}
                  href={att}
                  target="_blank"
                  rel="noreferrer"
                  className="text-discord-text-link underline text-sm"
                >
                  {att.split('/').pop()}
                </a>
              );
            })}
          </div>
        )}

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map(r => {
              const userReacted = r.userIds?.includes(user?.id);
              return (
                <button
                  key={r.emoji}
                  onClick={() => handleReaction(r.emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm border transition-colors ${
                    userReacted
                      ? 'bg-discord-brand/20 border-discord-brand text-discord-brand'
                      : 'bg-discord-hover border-discord-separator text-discord-text-muted hover:border-discord-brand/50'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-xs font-medium">{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover action bar */}
      {hovered && !editing && (
        <div className="absolute right-4 -top-4 flex items-center gap-1 bg-discord-dark border border-discord-separator rounded-lg shadow-lg px-1 py-0.5">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(p => !p)}
              className="p-1.5 rounded hover:bg-discord-hover text-discord-text-muted hover:text-discord-text transition-colors"
              title="Reaksiyon ekle"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleReaction}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
          {isOwn && (
            <button
              onClick={() => { setEditing(true); setEditContent(message.content || ''); }}
              className="p-1.5 rounded hover:bg-discord-hover text-discord-text-muted hover:text-discord-text transition-colors"
              title="Mesajı düzenle"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded hover:bg-discord-red/20 text-discord-text-muted hover:text-discord-red transition-colors"
              title="Mesajı sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="bg-discord-dark rounded-lg p-6 w-96 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-discord-text mb-2">Mesajı Sil</h3>
            <p className="text-discord-text-muted text-sm mb-4">Bu mesajı silmek istediğinden emin misin? Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-discord-text hover:underline text-sm"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-discord-red hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Date Separator ──────────────────────────────────────────────────────────

function DateSeparator({ dateStr }) {
  return (
    <div className="flex items-center gap-3 px-4 my-4">
      <div className="flex-1 h-px bg-discord-separator" />
      <span className="text-xs font-semibold text-discord-text-muted whitespace-nowrap">
        {formatDateSeparator(dateStr)}
      </span>
      <div className="flex-1 h-px bg-discord-separator" />
    </div>
  );
}

// ─── Welcome Message ─────────────────────────────────────────────────────────

function WelcomeMessage({ channelName, type }) {
  return (
    <div className="px-4 pb-4">
      <div className="w-16 h-16 rounded-full bg-discord-brand/20 flex items-center justify-center mb-4">
        <span className="text-3xl">{type === 'channel' ? '#' : '👋'}</span>
      </div>
      <h2 className="text-2xl font-bold text-discord-text mb-2">
        {type === 'channel' ? `#${channelName} kanalına hoş geldin!` : `${channelName} ile konuşman`}
      </h2>
      <p className="text-discord-text-muted text-sm">
        {type === 'channel'
          ? `Bu, #${channelName} kanalının başlangıcı.`
          : `Bu, ${channelName} ile olan özel mesajlaşmanın başlangıcı.`}
      </p>
    </div>
  );
}

// ─── MessageList ─────────────────────────────────────────────────────────────

export default function MessageList({ messages, setMessages, channelName, type }) {
  const containerRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages]);

  // Group messages: same author within 7 minutes
  const grouped = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = messages[i - 1];

    let showDateSeparator = false;
    if (!prev) {
      showDateSeparator = true;
    } else {
      const prevDate = prev.created_at?.slice(0, 10);
      const currDate = msg.created_at?.slice(0, 10);
      if (prevDate !== currDate) showDateSeparator = true;
    }

    let isGrouped = false;
    if (prev && !showDateSeparator) {
      const prevAuthorId = prev.author?.id || prev.author_id;
      const currAuthorId = msg.author?.id || msg.author_id;
      const timeDiff = differenceInMinutes(
        parseISO(msg.created_at),
        parseISO(prev.created_at)
      );
      if (prevAuthorId === currAuthorId && timeDiff < 7) {
        isGrouped = true;
      }
    }

    grouped.push({ msg, isGrouped, showDateSeparator });
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-discord-darker scrollbar-track-transparent"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e1f22 transparent' }}
    >
      <WelcomeMessage channelName={channelName} type={type} />

      {grouped.map(({ msg, isGrouped, showDateSeparator }) => (
        <div key={msg.id}>
          {showDateSeparator && messages.indexOf(msg) > 0 && (
            <DateSeparator dateStr={msg.created_at} />
          )}
          <Message
            message={msg}
            isGrouped={isGrouped}
            setMessages={setMessages}
          />
        </div>
      ))}

      <div className="h-4" />
    </div>
  );
}
