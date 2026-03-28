import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Users, MessageSquare } from 'lucide-react';
import UserPanel from './UserPanel';

function OnlineDot({ online }) {
  return (
    <span
      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-dark ${
        online ? 'bg-discord-green' : 'bg-discord-text-muted'
      }`}
    />
  );
}

function DMAvatar({ user }) {
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  const colors = [
    'bg-discord-brand',
    'bg-discord-green',
    'bg-purple-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-red-500',
    'bg-blue-500',
  ];
  const colorIndex =
    user?.username
      ? user.username.charCodeAt(0) % colors.length
      : 0;

  return (
    <div className="relative shrink-0">
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.username}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${colors[colorIndex]}`}
        >
          {initials}
        </div>
      )}
      <OnlineDot online={user?.online} />
    </div>
  );
}

export default function DMSidebar({ dmChannels, onDMsChange }) {
  const navigate = useNavigate();
  const { dmId } = useParams();
  const [search, setSearch] = useState('');

  const filtered = dmChannels.filter((dm) => {
    const name = dm.user?.username || dm.name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-60 min-w-60 h-full bg-discord-dark flex flex-col overflow-hidden">
      {/* Search bar */}
      <div className="px-2 pt-3 pb-2 shrink-0">
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-2 bg-discord-darker text-discord-text-muted hover:text-discord-text rounded-md px-2 py-1.5 text-sm transition-colors group cursor-text"
        >
          <Search size={14} className="shrink-0" />
          <input
            type="text"
            placeholder="Bir sohbet bul veya başlat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-discord-text placeholder-discord-text-muted text-sm cursor-text min-w-0"
          />
        </button>
      </div>

      {/* Friends button */}
      <div className="px-2 mb-1 shrink-0">
        <button
          onClick={() => navigate('/channels/@me')}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors text-sm font-medium cursor-pointer ${
            !dmId
              ? 'bg-discord-active text-white'
              : 'text-discord-text-muted hover:bg-discord-hover hover:text-discord-text'
          }`}
        >
          <Users size={20} className="shrink-0" />
          <span>Arkadaşlar</span>
        </button>
      </div>

      {/* DM list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-discord-darker">
        <div className="px-2 mb-1">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-discord-text-muted text-xs font-bold uppercase tracking-wider">
              Direkt Mesajlar
            </span>
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <MessageSquare size={32} className="text-discord-text-muted mb-2" />
              <p className="text-discord-text-muted text-xs">
                {search ? 'Sonuç bulunamadı.' : 'Henüz mesajın yok.'}
              </p>
            </div>
          )}

          {filtered.map((dm) => {
            const name = dm.user?.username || dm.name || 'Bilinmiyor';
            const isActive = dmId === dm.id || dmId === String(dm.id);
            return (
              <button
                key={dm.id}
                onClick={() => navigate(`/channels/@me/${dm.id}`)}
                className={`group w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-discord-active text-white'
                    : 'text-discord-text-muted hover:bg-discord-hover hover:text-discord-text'
                }`}
              >
                <DMAvatar user={dm.user} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{name}</div>
                  {dm.lastMessage && (
                    <div className="text-xs text-discord-text-muted truncate opacity-80">
                      {dm.lastMessage}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* User panel */}
      <UserPanel />
    </div>
  );
}
