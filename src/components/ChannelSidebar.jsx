import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import UserPanel from './UserPanel';

function CreateChannelModal({ serverId, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      await onCreate(trimmed, type);
      onClose();
    } catch (err) {
      setError(err.message || 'Kanal oluşturulamadı.');
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
        <h2 className="text-white text-xl font-bold mb-1">Kanal Oluştur</h2>
        <p className="text-discord-text-muted text-sm mb-5">
          #{name || 'kanal-adı'} kanalı oluşturulacak
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Channel type selector */}
          <div className="flex flex-col gap-2">
            <label className="text-discord-text text-xs font-bold uppercase tracking-wide">
              Kanal Türü
            </label>
            <button
              type="button"
              onClick={() => setType('text')}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                type === 'text'
                  ? 'border-discord-brand bg-discord-active/30 text-white'
                  : 'border-transparent bg-discord-darker text-discord-text-muted hover:bg-discord-hover'
              }`}
            >
              <Hash size={20} />
              <div className="text-left">
                <div className="font-semibold text-sm">Metin</div>
                <div className="text-xs opacity-70">Mesaj, görsel ve dosya gönder</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setType('voice')}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                type === 'voice'
                  ? 'border-discord-brand bg-discord-active/30 text-white'
                  : 'border-transparent bg-discord-darker text-discord-text-muted hover:bg-discord-hover'
              }`}
            >
              <Volume2 size={20} />
              <div className="text-left">
                <div className="font-semibold text-sm">Ses</div>
                <div className="text-xs opacity-70">Sesli ve görüntülü konuş</div>
              </div>
            </button>
          </div>

          <div>
            <label className="block text-discord-text text-xs font-bold mb-2 uppercase tracking-wide">
              Kanal Adı
            </label>
            <div className="flex items-center bg-discord-darker rounded-md px-3 gap-1 focus-within:ring-2 focus-within:ring-discord-brand">
              {type === 'text' ? (
                <Hash size={16} className="text-discord-text-muted shrink-0" />
              ) : (
                <Volume2 size={16} className="text-discord-text-muted shrink-0" />
              )}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="yeni-kanal"
                maxLength={100}
                className="w-full bg-transparent text-discord-text placeholder-discord-text-muted py-2 text-sm outline-none"
                autoFocus
              />
            </div>
          </div>

          {error && <p className="text-discord-red text-xs">{error}</p>}

          <div className="flex gap-3 justify-end mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-discord-text hover:underline"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-discord-brand hover:bg-discord-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-md transition-colors text-sm"
            >
              {loading ? 'Oluşturuluyor…' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChannelItem({ channel, isActive, serverId, onClick }) {
  const Icon = channel.type === 'voice' ? Volume2 : Hash;
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md mx-2 text-sm transition-colors cursor-pointer ${
        isActive
          ? 'bg-discord-active text-white'
          : 'text-discord-text-muted hover:bg-discord-hover hover:text-discord-text'
      }`}
      style={{ width: 'calc(100% - 16px)' }}
    >
      <Icon size={16} className="shrink-0 opacity-70" />
      <span className="truncate">{channel.name}</span>
    </button>
  );
}

export default function ChannelSidebar({ server, onServerChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { channelId } = useParams();
  const [textCollapsed, setTextCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('text');

  const isOwner = server && user && (server.owner_id === user.id || server.ownerId === user.id);

  const textChannels = server?.channels?.filter((c) => c.type === 'text') ?? [];
  const voiceChannels = server?.channels?.filter((c) => c.type === 'voice') ?? [];

  const handleCreateChannel = async (name, type) => {
    await apiFetch(`/api/servers/${server.id}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    });
    // Reload server to get updated channels
    const data = await apiFetch(`/api/servers/${server.id}`);
    const srv = { ...data.server, channels: data.channels, members: data.members, id: data.server?.id || server.id };
    onServerChange(srv);
  };

  const openCreateModal = (type) => {
    setCreateType(type);
    setShowCreateModal(true);
  };

  if (!server) {
    return (
      <div className="w-60 min-w-60 h-full bg-discord-dark flex flex-col">
        <div className="h-12 border-b border-discord-separator" />
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <>
      <div className="w-60 min-w-60 h-full bg-discord-dark flex flex-col overflow-hidden">
        {/* Server name header */}
        <button className="h-12 px-4 flex items-center justify-between border-b border-discord-separator hover:bg-discord-hover transition-colors cursor-pointer group shrink-0">
          <span className="text-white font-bold text-sm truncate">{server.name}</span>
          <ChevronDown size={16} className="text-discord-text-muted group-hover:text-white transition-colors shrink-0" />
        </button>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-discord-darker">
          {/* Text channels */}
          <div className="mt-2">
            <div className="flex items-center px-2 mb-1 group">
              <button
                onClick={() => setTextCollapsed(!textCollapsed)}
                className="flex items-center gap-1 flex-1 text-discord-text-muted hover:text-discord-text text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {textCollapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                Metin Kanalları
              </button>
              {isOwner && (
                <button
                  onClick={() => openCreateModal('text')}
                  className="opacity-0 group-hover:opacity-100 text-discord-text-muted hover:text-white transition-all p-0.5 rounded"
                  title="Metin kanalı ekle"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {!textCollapsed &&
              textChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={channelId === channel.id}
                  serverId={server.id}
                  onClick={() => navigate(`/channels/${server.id}/${channel.id}`)}
                />
              ))}
          </div>

          {/* Voice channels */}
          <div className="mt-4">
            <div className="flex items-center px-2 mb-1 group">
              <button
                onClick={() => setVoiceCollapsed(!voiceCollapsed)}
                className="flex items-center gap-1 flex-1 text-discord-text-muted hover:text-discord-text text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {voiceCollapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                Ses Kanalları
              </button>
              {isOwner && (
                <button
                  onClick={() => openCreateModal('voice')}
                  className="opacity-0 group-hover:opacity-100 text-discord-text-muted hover:text-white transition-all p-0.5 rounded"
                  title="Ses kanalı ekle"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {!voiceCollapsed &&
              voiceChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={channelId === channel.id}
                  serverId={server.id}
                  onClick={() => navigate(`/channels/${server.id}/${channel.id}`)}
                />
              ))}
          </div>
        </div>

        {/* User panel */}
        <UserPanel />
      </div>

      {showCreateModal && (
        <CreateChannelModal
          serverId={server.id}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateChannel}
        />
      )}
    </>
  );
}
