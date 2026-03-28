import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { apiFetch } from '../utils/api';

// Discord "blurple" logo mark as inline SVG
function DiscordLogo() {
  return (
    <svg width="28" height="20" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M60.105 4.898A58.55 58.55 0 0 0 45.653.415a.22.22 0 0 0-.233.11 40.784 40.784 0 0 0-1.8 3.698c-5.456-.817-10.885-.817-16.23 0a37.3 37.3 0 0 0-1.828-3.698.229.229 0 0 0-.233-.11 58.386 58.386 0 0 0-14.451 4.483.208.208 0 0 0-.096.082C1.577 18.956-.96 32.58.299 46.035a.244.244 0 0 0 .093.166c6.073 4.46 11.955 7.167 17.729 8.962a.231.231 0 0 0 .249-.082 42.08 42.08 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 38.772 38.772 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.22.22 0 0 1 .23-.031c11.617 5.304 24.198 5.304 35.68 0a.219.219 0 0 1 .232.028c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.384 36.384 0 0 1-5.54 2.637.227.227 0 0 0-.12.315 47.249 47.249 0 0 0 3.623 5.897.228.228 0 0 0 .249.084c5.801-1.795 11.684-4.502 17.757-8.962a.228.228 0 0 0 .092-.163c1.48-15.315-2.48-28.822-10.497-40.055a.18.18 0 0 0-.093-.084Zm-36.38 32.12c-3.497 0-6.38-3.211-6.38-7.156 0-3.944 2.826-7.156 6.38-7.156 3.583 0 6.438 3.24 6.38 7.156 0 3.945-2.826 7.156-6.38 7.156Zm23.593 0c-3.498 0-6.38-3.211-6.38-7.156 0-3.944 2.826-7.156 6.38-7.156 3.582 0 6.437 3.24 6.38 7.156 0 3.945-2.798 7.156-6.38 7.156Z" />
    </svg>
  );
}

function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute left-full ml-4 z-50 pointer-events-none">
          <div className="bg-black text-white text-sm font-semibold px-3 py-2 rounded-md whitespace-nowrap shadow-lg">
            {text}
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-black" />
        </div>
      )}
    </div>
  );
}

function ServerIcon({ server, isActive, onClick }) {
  const initials = server.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <Tooltip text={server.name}>
      <div className="relative flex items-center w-full justify-center my-0.5">
        {/* Active pill indicator */}
        <div
          className={`absolute left-0 bg-white rounded-r-full transition-all duration-200 ${
            isActive ? 'h-10 w-1' : 'h-2 w-1 opacity-0 group-hover:opacity-100'
          }`}
        />
        <button
          onClick={onClick}
          className={`group w-12 h-12 flex items-center justify-center font-bold text-sm transition-all duration-200 cursor-pointer overflow-hidden shadow-md ${
            isActive
              ? 'rounded-2xl bg-discord-brand text-white'
              : 'rounded-full bg-discord-dark text-discord-text hover:rounded-2xl hover:bg-discord-brand hover:text-white'
          }`}
        >
          {server.icon ? (
            <img
              src={server.icon}
              alt={server.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </button>
      </div>
    </Tooltip>
  );
}

function CreateServerModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      await onCreate(trimmed);
      onClose();
    } catch (err) {
      setError(err.message || 'Sunucu oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-discord-dark rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-discord-text-muted hover:text-discord-text transition-colors"
        >
          <X size={20} />
        </button>
        <h2 className="text-white text-2xl font-bold text-center mb-1">
          Sunucunu Özelleştir
        </h2>
        <p className="text-discord-text-muted text-sm text-center mb-6">
          Sunucuna bir isim vererek başla.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-discord-text text-xs font-bold mb-2 uppercase tracking-wide">
              Sunucu Adı
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sunucumun Adı"
              maxLength={100}
              className="w-full bg-discord-darker text-discord-text placeholder-discord-text-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-discord-brand"
              autoFocus
            />
          </div>
          {error && <p className="text-discord-red text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="bg-discord-brand hover:bg-discord-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition-colors text-sm"
          >
            {loading ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ServerSidebar({ servers, currentServer, onSelectServer, onServersChange }) {
  const [showModal, setShowModal] = useState(false);

  const handleCreate = async (name) => {
    await apiFetch('/api/servers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    onServersChange();
  };

  return (
    <>
      <div className="w-[72px] min-w-[72px] h-full bg-discord-darker flex flex-col items-center py-3 gap-0 overflow-y-auto overflow-x-hidden scrollbar-none">
        {/* Discord Home button */}
        <Tooltip text="Direk Mesajlar">
          <div className="relative flex items-center w-full justify-center my-0.5">
            <div
              className={`absolute left-0 bg-white rounded-r-full transition-all duration-200 ${
                !currentServer ? 'h-10 w-1' : 'h-2 w-1 opacity-0'
              }`}
            />
            <button
              onClick={() => onSelectServer('@me')}
              className={`w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-md ${
                !currentServer
                  ? 'rounded-2xl bg-discord-brand'
                  : 'rounded-full bg-discord-dark hover:rounded-2xl hover:bg-discord-brand'
              }`}
            >
              <DiscordLogo />
            </button>
          </div>
        </Tooltip>

        {/* Separator */}
        <div className="w-8 h-0.5 bg-discord-separator rounded-full my-2" />

        {/* Server list */}
        {servers.map((server) => (
          <ServerIcon
            key={server.id}
            server={server}
            isActive={currentServer?.id === server.id}
            onClick={() => onSelectServer(server.id)}
          />
        ))}

        {/* Separator before add button */}
        {servers.length > 0 && (
          <div className="w-8 h-0.5 bg-discord-separator rounded-full my-2" />
        )}

        {/* Add server button */}
        <Tooltip text="Sunucu Ekle">
          <div className="flex items-center w-full justify-center my-0.5">
            <button
              onClick={() => setShowModal(true)}
              className="w-12 h-12 rounded-full bg-discord-dark text-discord-green hover:rounded-2xl hover:bg-discord-green hover:text-white transition-all duration-200 flex items-center justify-center shadow-md cursor-pointer"
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </div>
        </Tooltip>
      </div>

      {showModal && (
        <CreateServerModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}
