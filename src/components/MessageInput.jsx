import { useState, useRef, useEffect } from 'react';
import { Plus, Smile, X, FileText } from 'lucide-react';

const QUICK_EMOJIS = [
  '😀','😂','😍','🥺','😎','🤔','😅','🥳',
  '❤️','🔥','👍','👎','🎉','✅','❌','💯',
  '😭','🙏','💀','👀','🤣','😱','🤩','😤',
  '🫡','💪','🤝','✨','🌟','💥','🎮','🎯',
];

function EmojiDropdown({ onSelect, onClose }) {
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
      className="absolute bottom-12 right-0 bg-discord-darker border border-discord-separator rounded-xl p-3 shadow-2xl z-50 w-72"
    >
      <div className="text-xs text-discord-text-muted font-semibold mb-2 uppercase tracking-wide">Emojiler</div>
      <div className="grid grid-cols-8 gap-1">
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-xl hover:bg-discord-hover rounded p-1 transition-colors leading-none"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MessageInput({ onSend, onTyping, channelName, type }) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]); // { file, preview, name }
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const MAX_CHARS = 2000;
  const charCount = content.length;
  const overLimit = charCount > MAX_CHARS;
  const nearLimit = charCount > 1800;

  const placeholder = type === 'channel'
    ? `#${channelName || 'kanal'} kanalına mesaj gönder`
    : `@${channelName || 'kullanıcı'} kullanıcısına mesaj gönder`;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';
  }, [content]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;
    if (overLimit) return;

    const attUrls = attachments.map(a => a.preview).filter(Boolean);
    onSend(trimmed, attUrls);
    setContent('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleChange = (e) => {
    setContent(e.target.value);
    onTyping?.();
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newAttachments = files.map(file => {
      const isImage = file.type.startsWith('image/');
      const preview = isImage ? URL.createObjectURL(file) : null;
      return { file, preview, name: file.name, isImage, size: file.size };
    });

    setAttachments(prev => [...prev, ...newAttachments]);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => {
      const next = [...prev];
      if (next[index].preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (!ta) {
      setContent(prev => prev + emoji);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = content.slice(0, start) + emoji + content.slice(end);
    setContent(newVal);
    // Restore cursor position after state update
    setTimeout(() => {
      ta.selectionStart = start + emoji.length;
      ta.selectionEnd = start + emoji.length;
      ta.focus();
    }, 0);
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="px-4 pb-6">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-discord-dark rounded-t-lg border-b border-discord-separator">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              {att.isImage ? (
                <div className="relative">
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="h-24 w-24 object-cover rounded border border-discord-separator"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-white px-1 py-0.5 rounded-b truncate">
                    {att.name}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-discord-hover rounded p-2 h-16 w-40">
                  <FileText className="w-8 h-8 text-discord-brand flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-discord-text truncate font-medium">{att.name}</div>
                    <div className="text-xs text-discord-text-muted">{formatBytes(att.size)}</div>
                  </div>
                </div>
              )}
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-discord-red rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <div className={`flex items-end gap-2 bg-discord-light rounded-lg px-3 py-2 ${attachments.length > 0 ? 'rounded-t-none' : ''}`}>
        {/* Attach button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.txt,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-7 h-7 rounded-full bg-discord-text-muted/30 hover:bg-discord-text-muted/50 flex items-center justify-center text-discord-text-muted hover:text-discord-text transition-colors flex-shrink-0 mb-0.5"
            title="Dosya ekle"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-discord-text placeholder-discord-text-muted resize-none outline-none text-sm leading-relaxed max-h-72 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e1f22 transparent' }}
        />

        {/* Character count */}
        {nearLimit && (
          <span className={`text-xs flex-shrink-0 mb-0.5 font-medium ${overLimit ? 'text-discord-red' : 'text-discord-yellow'}`}>
            {MAX_CHARS - charCount}
          </span>
        )}

        {/* Emoji button */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowEmoji(p => !p)}
            className={`w-6 h-6 flex items-center justify-center transition-colors mb-0.5 ${showEmoji ? 'text-discord-text' : 'text-discord-text-muted hover:text-discord-text'}`}
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <EmojiDropdown
              onSelect={(e) => { insertEmoji(e); }}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>
      </div>

      {/* Hint */}
      <div className="mt-1 text-xs text-discord-text-muted px-1">
        <kbd className="bg-discord-hover px-1 rounded text-[10px]">Enter</kbd> göndermek için,
        <kbd className="bg-discord-hover px-1 rounded text-[10px] ml-1">Shift+Enter</kbd> yeni satır eklemek için
      </div>
    </div>
  );
}
