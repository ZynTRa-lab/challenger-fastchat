import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user || !token) {
      // Disconnect if user logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setOnlineUsers([]);
      }
      return;
    }

    const s = io('/', {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      socketRef.current = s;
      setSocket(s);
    });

    // Track online users via presence events
    s.on('presence', (data) => {
      if (data.status === 'online') {
        setOnlineUsers((prev) =>
          prev.includes(data.userId) ? prev : [...prev, data.userId]
        );
      } else if (data.status === 'offline') {
        setOnlineUsers((prev) => prev.filter((id) => id !== data.userId));
      }
    });

    s.on('disconnect', () => {
      setSocket(null);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.off('presence');
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user, token]);

  const joinServer = useCallback((serverId) => {
    if (socketRef.current) {
      socketRef.current.emit('join-server', serverId);
    }
  }, []);

  const joinChannel = useCallback((channelId) => {
    if (socketRef.current) {
      socketRef.current.emit('join-channel', channelId);
    }
  }, []);

  const leaveChannel = useCallback((channelId) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-channel', channelId);
    }
  }, []);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, joinServer, joinChannel, leaveChannel }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
