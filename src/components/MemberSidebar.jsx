import { useState } from 'react';
import { X } from 'lucide-react';

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

function Avatar({ username, size = 8 }) {
  const color = getAvatarColor(username);
  const px = size === 8 ? '2rem' : '2.5rem';
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none"
      style={{ backgroundColor: color, width: px, height: px }}
    >
      {getInitials(username)}
    </div>
  );
}

// Profile popup shown when clicking a member
function ProfilePopup({ member, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-discord-dark rounded-xl shadow-2xl w-72 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner */}
        <div
          className="h-20 w-full"
          style={{ backgroundColor: getAvatarColor(member.username) }}
        />
        {/* Avatar overlapping banner */}
        <div className="px-4 -mt-8 pb-4">
          <div className="flex items-end justify-between mb-3">
            <div className="border-4 border-discord-dark rounded-full">
              <Avatar username={member.username} size={10} />
            </div>
            <button
              onClick={onClose}
              className="text-discord-text-muted hover:text-discord-text p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-3">
            <div className="font-bold text-discord-text text-lg leading-tight">{member.username}</div>
            <div className="text-discord-text-muted text-sm">{member.username.toLowerCase()}</div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-3 h-3 rounded-full ${member.status === 'online' ? 'bg-discord-green' : 'bg-discord-text-muted'}`} />
            <span className="text-sm text-discord-text-muted capitalize">
              {member.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
            </span>
          </div>

          {member.about && (
            <div className="bg-discord-medium rounded-lg p-3">
              <div className="text-xs font-semibold text-discord-text-muted uppercase mb-1">Hakkında</div>
              <p className="text-sm text-discord-text">{member.about}</p>
            </div>
          )}

          {member.role && (
            <div className="mt-2">
              <span className="text-xs font-semibold text-discord-text-muted uppercase">Rol: </span>
              <span className="text-xs text-discord-text capitalize">{member.role}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, onClick }) {
  const isOnline = member.status === 'online';
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-2 py-1.5 rounded hover:bg-discord-hover/50 text-left transition-colors group"
    >
      <div className="relative flex-shrink-0">
        <Avatar username={member.username} size={8} />
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-discord-dark ${
            isOnline ? 'bg-discord-green' : 'bg-discord-text-muted/50'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium truncate transition-colors ${isOnline ? 'text-discord-text group-hover:text-white' : 'text-discord-text-muted'}`}>
          {member.nickname || member.username}
        </div>
        {member.role && member.role !== 'member' && (
          <div className="text-xs text-discord-text-muted capitalize">{member.role}</div>
        )}
      </div>
    </button>
  );
}

export default function MemberSidebar({ members = [] }) {
  const [selectedMember, setSelectedMember] = useState(null);

  const online = members.filter(m => m.status === 'online');
  const offline = members.filter(m => m.status !== 'online');

  return (
    <>
      <div className="w-60 bg-discord-dark flex flex-col flex-shrink-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-discord-separator/50">
          <h3 className="text-xs font-semibold text-discord-text-muted uppercase tracking-wide">
            Üyeler — {members.length}
          </h3>
        </div>

        {/* Member list */}
        <div
          className="flex-1 overflow-y-auto px-2 py-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e1f22 transparent' }}
        >
          {/* Online group */}
          {online.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-semibold text-discord-text-muted uppercase tracking-wide">
                Çevrimiçi — {online.length}
              </div>
              <div className="space-y-0.5">
                {online.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onClick={() => setSelectedMember(member)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Offline group */}
          {offline.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-discord-text-muted uppercase tracking-wide mt-2">
                Çevrimdışı — {offline.length}
              </div>
              <div className="space-y-0.5">
                {offline.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onClick={() => setSelectedMember(member)}
                  />
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && (
            <p className="text-discord-text-muted text-xs text-center mt-4">Üye bulunamadı</p>
          )}
        </div>
      </div>

      {/* Profile popup */}
      {selectedMember && (
        <ProfilePopup
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </>
  );
}
