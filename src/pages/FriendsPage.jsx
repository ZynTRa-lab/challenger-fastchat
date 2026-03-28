import { useState, useEffect } from 'react';
import { UserPlus, MessageCircle, UserX, Check, X, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const AVATAR_COLORS = [
  '#5865f2', '#eb459e', '#ed4245', '#faa61a',
  '#57f287', '#1abc9c', '#3498db', '#e91e63',
];

function getAvatarColor(username = '') {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ username, size = 10 }) {
  const color = getAvatarColor(username);
  const px = `${size * 4}px`;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none"
      style={{ backgroundColor: color, width: px, height: px, fontSize: size >= 10 ? '0.9rem' : '0.75rem' }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}

const TABS = [
  { id: 'online', label: 'Çevrimiçi' },
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Beklemede' },
  { id: 'blocked', label: 'Engellenen' },
  { id: 'add', label: 'Arkadaş Ekle' },
];

// Empty state component
function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-discord-hover flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-discord-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-discord-text mb-2">{title}</h3>
      <p className="text-discord-text-muted text-sm max-w-xs">{description}</p>
    </div>
  );
}

export default function FriendsPage({ onDMsChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('online');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/users/me/friends');
      setFriends(data.friends || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async () => {
    if (!addInput.trim()) {
      setAddError('Lütfen bir kullanıcı adı gir.');
      return;
    }
    setAddLoading(true);
    setAddError('');
    setAddSuccess('');
    try {
      // First find user by username
      const searchData = await apiFetch(`/api/users/search?username=${encodeURIComponent(addInput.trim())}`);
      if (!searchData.user) {
        setAddError('Bu kullanıcı adıyla eşleşen bir kullanıcı bulunamadı.');
        return;
      }
      await apiFetch(`/api/users/friends/${searchData.user.id}`, { method: 'POST' });
      setAddSuccess(`${addInput.trim()} kullanıcısına arkadaşlık isteği gönderildi!`);
      setAddInput('');
      await loadFriends();
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('already exists') || msg.includes('already friends')) {
        setAddError('Bu kişiyle zaten bir arkadaşlık ilişkin var.');
      } else if (msg.includes('yourself')) {
        setAddError('Kendine arkadaşlık isteği gönderemezsin.');
      } else if (msg.includes('not found') || msg.includes('404')) {
        setAddError('Bu kullanıcı adıyla eşleşen biri bulunamadı.');
      } else {
        setAddError('Arkadaşlık isteği gönderilemedi. Lütfen tekrar dene.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  const acceptRequest = async (friendId) => {
    try {
      await apiFetch(`/api/users/friends/${friendId}/accept`, { method: 'PUT' });
      await loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const removeFriend = async (friendId) => {
    try {
      await apiFetch(`/api/users/friends/${friendId}`, { method: 'DELETE' });
      await loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const openDM = async (friendId) => {
    try {
      // Send DM will create the channel; navigate to DM
      navigate(`/channels/@me/${friendId}`);
      if (onDMsChange) onDMsChange();
    } catch (e) {
      console.error(e);
    }
  };

  // Categorise friends
  const accepted = friends.filter(f => f.friend_status === 'accepted');
  const online = accepted.filter(f => f.status === 'online');
  const pendingIncoming = friends.filter(f => f.friend_status === 'pending' && f.incoming);
  const pendingOutgoing = friends.filter(f => f.friend_status === 'pending' && !f.incoming);

  const filtered = (list) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(f => f.username?.toLowerCase().includes(q));
  };

  const renderFriendRow = (friend, options = {}) => {
    const { showAccept, showDecline, showMessage, showRemove, dimmed } = options;
    return (
      <div
        key={friend.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-discord-hover/50 transition-colors group ${dimmed ? 'opacity-50' : ''}`}
      >
        <div className="relative flex-shrink-0">
          <Avatar username={friend.username} size={10} />
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-discord-medium ${
            friend.status === 'online' ? 'bg-discord-green' : 'bg-discord-text-muted/50'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-discord-text text-sm truncate">{friend.username}</div>
          <div className="text-xs text-discord-text-muted truncate">
            {friend.friend_status === 'accepted'
              ? (friend.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı')
              : options.requestType === 'incoming'
                ? 'Gelen arkadaşlık isteği'
                : 'Gönderilen arkadaşlık isteği'
            }
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {showMessage && (
            <button
              onClick={() => openDM(friend.id)}
              className="w-9 h-9 bg-discord-hover rounded-full flex items-center justify-center text-discord-text-muted hover:text-discord-text hover:bg-discord-light transition-colors"
              title="Mesaj Gönder"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}
          {showAccept && (
            <button
              onClick={() => acceptRequest(friend.id)}
              className="w-9 h-9 bg-discord-green/20 rounded-full flex items-center justify-center text-discord-green hover:bg-discord-green hover:text-white transition-colors"
              title="Kabul Et"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {(showDecline || showRemove) && (
            <button
              onClick={() => removeFriend(friend.id)}
              className="w-9 h-9 bg-discord-red/20 rounded-full flex items-center justify-center text-discord-red hover:bg-discord-red hover:text-white transition-colors"
              title={showDecline ? 'Reddet' : 'Arkadaşı Kaldır'}
            >
              {showDecline ? <X className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === 'add') {
      return (
        <div className="flex-1 flex flex-col p-8 max-w-lg">
          <h2 className="text-xl font-bold text-discord-text mb-1">Arkadaş Ekle</h2>
          <p className="text-discord-text-muted text-sm mb-6">
            Kullanıcı adıyla arkadaş ekleyebilirsin.
          </p>

          <div className={`flex items-center gap-3 bg-discord-darker rounded-lg p-1 pl-4 border ${
            addError ? 'border-discord-red' : addSuccess ? 'border-discord-green' : 'border-discord-separator focus-within:border-discord-brand'
          } transition-colors`}>
            <input
              type="text"
              value={addInput}
              onChange={e => { setAddInput(e.target.value); setAddError(''); setAddSuccess(''); }}
              onKeyDown={e => e.key === 'Enter' && sendFriendRequest()}
              placeholder="Bir kullanıcı adı gir"
              className="flex-1 bg-transparent text-discord-text placeholder-discord-text-muted/60 outline-none text-sm py-2"
            />
            <button
              onClick={sendFriendRequest}
              disabled={addLoading || !addInput.trim()}
              className="px-4 py-2 bg-discord-brand hover:bg-discord-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-semibold text-sm transition-colors flex items-center gap-2"
            >
              {addLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              İstek Gönder
            </button>
          </div>

          {addError && (
            <p className="mt-2 text-sm text-discord-red flex items-center gap-1">
              <X className="w-3 h-3" /> {addError}
            </p>
          )}
          {addSuccess && (
            <p className="mt-2 text-sm text-discord-green flex items-center gap-1">
              <Check className="w-3 h-3" /> {addSuccess}
            </p>
          )}

          <div className="mt-8 border-t border-discord-separator pt-6">
            <h3 className="text-xs font-semibold text-discord-text-muted uppercase tracking-wide mb-3">
              Yakın Zamanda Oynadıkları
            </h3>
            <p className="text-sm text-discord-text-muted">Yakın zamanda oynanan oyun yok.</p>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-discord-brand/30 border-t-discord-brand rounded-full animate-spin" />
        </div>
      );
    }

    if (activeTab === 'online') {
      const list = filtered(online);
      return (
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <div className="px-2 mb-3 text-xs font-semibold text-discord-text-muted uppercase tracking-wide">
            Çevrimiçi — {list.length}
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Çevrimiçi arkadaş yok"
              description="Hiçbir arkadaşın şu anda çevrimiçi değil. Arkadaşlarını davet ederek başla!"
            />
          ) : (
            <div>
              {list.map(f => renderFriendRow(f, { showMessage: true, showRemove: true }))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'all') {
      const list = filtered(accepted);
      return (
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <div className="px-2 mb-3 text-xs font-semibold text-discord-text-muted uppercase tracking-wide">
            Tüm Arkadaşlar — {list.length}
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Henüz arkadaşın yok"
              description="Arkadaş eklemek için \"Arkadaş Ekle\" sekmesine git."
            />
          ) : (
            <div>
              {list.map(f => renderFriendRow(f, { showMessage: true, showRemove: true }))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'pending') {
      const incoming = filtered(pendingIncoming);
      const outgoing = filtered(pendingOutgoing);
      const total = incoming.length + outgoing.length;
      return (
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <div className="px-2 mb-3 text-xs font-semibold text-discord-text-muted uppercase tracking-wide">
            Beklemede — {total}
          </div>
          {total === 0 && (
            <EmptyState
              icon={UserPlus}
              title="Bekleyen istek yok"
              description="Bekleyen gelen veya gönderilen arkadaşlık isteğin yok."
            />
          )}
          {incoming.length > 0 && (
            <div className="mb-4">
              <div className="px-2 mb-2 text-xs text-discord-text-muted">Gelen — {incoming.length}</div>
              {incoming.map(f => renderFriendRow(f, { showAccept: true, showDecline: true, requestType: 'incoming' }))}
            </div>
          )}
          {outgoing.length > 0 && (
            <div>
              <div className="px-2 mb-2 text-xs text-discord-text-muted">Gönderilen — {outgoing.length}</div>
              {outgoing.map(f => renderFriendRow(f, { showDecline: true, requestType: 'outgoing', dimmed: false }))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'blocked') {
      return (
        <EmptyState
          icon={UserX}
          title="Engellenen kullanıcı yok"
          description="Engellediğin kullanıcılar burada görünecek."
        />
      );
    }

    return null;
  };

  return (
    <div className="flex-1 flex flex-col bg-discord-medium min-w-0 overflow-hidden">
      {/* Header */}
      <div className="h-12 min-h-[48px] flex items-center px-4 border-b border-discord-darker/50 shadow-md gap-4">
        <div className="flex items-center gap-2 text-discord-text">
          <Users className="w-5 h-5 text-discord-text-muted" />
          <span className="font-semibold">Arkadaşlar</span>
        </div>
        <div className="w-px h-6 bg-discord-separator" />

        {/* Tab bar */}
        <nav className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? tab.id === 'add'
                    ? 'bg-discord-green/20 text-discord-green hover:bg-discord-green/30'
                    : 'bg-discord-hover text-discord-text'
                  : 'text-discord-text-muted hover:text-discord-text hover:bg-discord-hover/50'
              }`}
            >
              {tab.label}
              {tab.id === 'pending' && (pendingIncoming.length + pendingOutgoing.length) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-discord-red text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {pendingIncoming.length + pendingOutgoing.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search bar (for friends lists, not add tab) */}
      {activeTab !== 'add' && (
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ara"
              className="w-full bg-discord-darker text-discord-text placeholder-discord-text-muted/60 rounded pl-9 pr-3 py-1.5 text-sm outline-none border border-discord-separator focus:border-discord-brand transition-colors"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {renderContent()}
      </div>

      {/* Active now sidebar hint */}
      {activeTab !== 'add' && (
        <div className="hidden xl:block" />
      )}
    </div>
  );
}
