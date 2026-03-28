import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Headphones, Settings, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// lucide-react doesn't ship HeadphonesOff; build a simple crossed version
function HeadphonesOff({ size = 20, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 9-9" />
      <path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-7a9 9 0 0 0-1.17-4.46" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

const STATUS_OPTIONS = [
  { key: 'online', label: 'Çevrimiçi', color: 'bg-discord-green' },
  { key: 'idle', label: 'Boşta', color: 'bg-discord-yellow' },
  { key: 'dnd', label: 'Rahatsız Etme', color: 'bg-discord-red' },
  { key: 'invisible', label: 'Görünmez', color: 'bg-discord-text-muted' },
];

function StatusDot({ status, className = '' }) {
  const statusColor = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    invisible: 'bg-discord-text-muted',
  }[status] ?? 'bg-discord-green';

  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor} ${className}`} />
  );
}

function UserAvatar({ user, size = 'sm' }) {
  const sizeCls = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-8 h-8 text-xs';
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?';

  const colors = [
    'bg-discord-brand',
    'bg-discord-green',
    'bg-purple-500',
    'bg-yellow-500',
    'bg-pink-500',
  ];
  const colorIndex = user?.username ? user.username.charCodeAt(0) % colors.length : 0;

  return (
    <div className={`${sizeCls} rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden ${colors[colorIndex]}`}>
      {user?.avatar ? (
        <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function StatusModal({ user, currentStatus, onStatusChange, onClose }) {
  const statusLabel = {
    online: 'Çevrimiçi',
    idle: 'Boşta',
    dnd: 'Rahatsız Etme',
    invisible: 'Görünmez',
  }[currentStatus] ?? 'Çevrimiçi';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-start pb-20 pl-16"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Invisible overlay */}
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-discord-dark rounded-xl shadow-2xl w-64 p-3 border border-discord-separator">
        {/* User info */}
        <div className="flex items-center gap-3 p-2 mb-2">
          <div className="relative">
            <UserAvatar user={user} size="lg" />
            <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-discord-dark ${
              STATUS_OPTIONS.find((s) => s.key === currentStatus)?.color ?? 'bg-discord-green'
            }`} />
          </div>
          <div>
            <div className="text-white font-bold text-sm">{user?.username}</div>
            <div className="text-discord-text-muted text-xs">{statusLabel}</div>
          </div>
        </div>

        <div className="h-px bg-discord-separator mb-2" />

        {/* Status options */}
        <div className="flex flex-col gap-0.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { onStatusChange(opt.key); onClose(); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                currentStatus === opt.key
                  ? 'bg-discord-active text-white'
                  : 'text-discord-text hover:bg-discord-hover'
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${opt.color} shrink-0`} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UserPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [micOn, setMicOn] = useState(true);
  const [headphonesOn, setHeadphonesOn] = useState(true);
  const [status, setStatus] = useState('online');
  const [showStatusModal, setShowStatusModal] = useState(false);

  const iconBtn =
    'p-1.5 rounded-md text-discord-text-muted hover:text-white hover:bg-discord-hover transition-colors cursor-pointer';

  return (
    <>
      <div className="h-14 bg-discord-darker flex items-center px-2 gap-1 shrink-0 border-t border-discord-separator">
        {/* Avatar + name */}
        <button
          onClick={() => setShowStatusModal(!showStatusModal)}
          className="flex items-center gap-2 flex-1 min-w-0 px-1 py-1 rounded-md hover:bg-discord-hover transition-colors cursor-pointer text-left"
        >
          <div className="relative shrink-0">
            <UserAvatar user={user} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darker ${
                STATUS_OPTIONS.find((s) => s.key === status)?.color ?? 'bg-discord-green'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate leading-tight">
              {user?.username ?? '…'}
            </div>
            <div className="text-discord-text-muted text-xs truncate leading-tight">
              {STATUS_OPTIONS.find((s) => s.key === status)?.label ?? 'Çevrimiçi'}
            </div>
          </div>
        </button>

        {/* Mic toggle */}
        <button
          onClick={() => setMicOn(!micOn)}
          className={iconBtn}
          title={micOn ? 'Mikrofonu Kapat' : 'Mikrofonu Aç'}
        >
          {micOn ? <Mic size={18} /> : <MicOff size={18} className="text-discord-red" />}
        </button>

        {/* Headphones toggle */}
        <button
          onClick={() => setHeadphonesOn(!headphonesOn)}
          className={iconBtn}
          title={headphonesOn ? 'Kulaklığı Kapat' : 'Kulaklığı Aç'}
        >
          {headphonesOn ? (
            <Headphones size={18} />
          ) : (
            <HeadphonesOff size={18} className="text-discord-red" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className={iconBtn}
          title="Kullanıcı Ayarları"
        >
          <Settings size={18} />
        </button>
      </div>

      {showStatusModal && (
        <StatusModal
          user={user}
          currentStatus={status}
          onStatusChange={setStatus}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    </>
  );
}
