import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { apiFetch } from '../utils/api';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';
import ChatArea from './ChatArea';
import MemberSidebar from './MemberSidebar';
import FriendsPage from '../pages/FriendsPage';

export default function MainLayout() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [showMembers, setShowMembers] = useState(true);
  const [dmChannels, setDmChannels] = useState([]);

  useEffect(() => {
    loadServers();
    loadDMs();
  }, []);

  const loadServers = async () => {
    try {
      const data = await apiFetch('/api/servers');
      setServers(data.servers || data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDMs = async () => {
    try {
      const data = await apiFetch('/api/users/me/dms');
      const dms = (data.dms || data || []).map(dm => ({
        id: dm.user_id || dm.id,
        dm_channel_id: dm.dm_channel_id,
        user: { username: dm.username, avatar: dm.avatar, status: dm.status, id: dm.user_id },
        lastMessage: dm.lastMessage?.content || null,
      }));
      setDmChannels(dms);
    } catch (e) {
      console.error(e);
    }
  };

  const selectServer = async (serverId) => {
    if (serverId === '@me') {
      setCurrentServer(null);
      navigate('/channels/@me');
      return;
    }
    try {
      const data = await apiFetch(`/api/servers/${serverId}`);
      const srv = { ...data.server, channels: data.channels, members: data.members, id: data.server?.id || serverId };
      setCurrentServer(srv);
      if (socket) socket.emit('join-server', serverId);
      const firstChannel = srv.channels?.find((c) => c.type === 'text');
      if (firstChannel) {
        navigate(`/channels/${serverId}/${firstChannel.id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-discord-medium">
      <ServerSidebar
        servers={servers}
        currentServer={currentServer}
        onSelectServer={selectServer}
        onServersChange={loadServers}
      />
      <Routes>
        <Route
          path="@me/*"
          element={
            <>
              <DMSidebar dmChannels={dmChannels} onDMsChange={loadDMs} />
              <Routes>
                <Route index element={<FriendsPage />} />
                <Route
                  path=":dmId"
                  element={<ChatArea type="dm" onDMsChange={loadDMs} />}
                />
              </Routes>
            </>
          }
        />
        <Route
          path=":serverId/:channelId"
          element={
            <>
              <ChannelSidebar
                server={currentServer}
                onServerChange={(s) => setCurrentServer(s)}
              />
              <ChatArea
                type="channel"
                server={currentServer}
                showMembers={showMembers}
                onToggleMembers={() => setShowMembers(!showMembers)}
              />
              {showMembers && currentServer && (
                <MemberSidebar members={currentServer.members || []} />
              )}
            </>
          }
        />
      </Routes>
    </div>
  );
}
