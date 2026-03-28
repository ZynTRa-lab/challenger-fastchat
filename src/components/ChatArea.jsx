import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, Users, Search, Inbox, HelpCircle, AtSign } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ChatArea({ type, server, showMembers, onToggleMembers, onDMsChange }) {
  const { channelId, dmId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState(null);
  const [dmUser, setDmUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});

  // Load channel info and messages when channelId/dmId changes
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);

    if (type === 'channel' && channelId && server) {
      const ch = server.channels?.find(c => c.id === channelId);
      setChannel(ch || null);
      loadMessages(`/api/channels/${channelId}/messages`);
      if (socket) {
        socket.emit('join-channel', channelId);
        return () => socket.emit('leave-channel', channelId);
      }
    } else if (type === 'dm' && dmId) {
      loadDMInfo();
      loadMessages(`/api/dm/${dmId}/messages`);
      if (socket) {
        socket.emit('join-dm', dmId);
      }
    }
  }, [channelId, dmId, server]);

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      if (type === 'channel' && msg.channel_id === channelId) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
    };

    const handleDM = (msg) => {
      if (type === 'dm' && msg.dm_channel_id === dmId) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
    };

    const handleEdit = (msg) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
    };

    const handleDelete = ({ id }) => {
      setMessages(prev => prev.filter(m => m.id !== id));
    };

    const handleReactionAdd = ({ messageId, reactions }) => {
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, reactions } : m)
      );
    };

    const handleReactionRemove = ({ messageId, reactions }) => {
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, reactions } : m)
      );
    };

    const handleTyping = ({ userId, username, channelId: typChId }) => {
      if (typChId === channelId && userId !== user?.id) {
        setTypingUsers(prev => {
          if (prev.find(u => u.userId === userId)) return prev;
          return [...prev, { userId, username }];
        });
        clearTimeout(typingTimeoutRef.current[userId]);
        typingTimeoutRef.current[userId] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== userId));
        }, 3000);
      }
    };

    socket.on('message', handleMessage);
    socket.on('dm-message', handleDM);
    socket.on('message-update', handleEdit);
    socket.on('message-delete', handleDelete);
    socket.on('reaction-add', handleReactionAdd);
    socket.on('reaction-remove', handleReactionRemove);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('message', handleMessage);
      socket.off('dm-message', handleDM);
      socket.off('message-update', handleEdit);
      socket.off('message-delete', handleDelete);
      socket.off('reaction-add', handleReactionAdd);
      socket.off('reaction-remove', handleReactionRemove);
      socket.off('typing', handleTyping);
    };
  }, [socket, channelId, dmId, type, user?.id]);

  const loadMessages = async (url) => {
    try {
      const data = await apiFetch(url);
      const msgs = data.messages || data;

      // If DM, extract the other user info from messages
      if (type === 'dm' && Array.isArray(msgs) && msgs.length > 0) {
        const otherMsg = msgs.find(m => m.author?.id !== user?.id);
        if (otherMsg?.author) {
          setDmUser(otherMsg.author);
        }
      }

      // Store dmChannelId for socket room tracking
      if (data.dmChannelId && socket) {
        socket.emit('join-dm', data.dmChannelId);
      }

      setMessages(Array.isArray(msgs) ? msgs : []);
      setTimeout(scrollToBottom, 100);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDMInfo = async () => {
    try {
      const data = await apiFetch(`/api/users/${dmId}`);
      if (data.user) setDmUser(data.user);
    } catch (e) {
      // DM info will come from messages
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (content, attachments) => {
    if (!content?.trim() && (!attachments || attachments.length === 0)) return;
    try {
      if (type === 'channel') {
        await apiFetch(`/api/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content, attachments }),
        });
      } else {
        const res = await apiFetch(`/api/dm/${dmId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content, attachments }),
        });
        // Notify parent to refresh DM list
        if (onDMsChange) onDMsChange();
        // If no dmUser set yet, populate from response
        if (!dmUser && res?.message?.author) {
          const other = messages.find(m => m.author?.id !== user?.id);
          if (!other) setDmUser(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTypingEmit = () => {
    if (socket && type === 'channel' && channelId) {
      socket.emit('typing', { channelId, username: user?.username, userId: user?.id });
    }
  };

  const channelName = type === 'channel' ? channel?.name : (dmUser?.username || 'DM');

  const typingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1)
      return <><span className="font-semibold text-discord-text">{typingUsers[0].username}</span> yazıyor...</>;
    if (typingUsers.length === 2)
      return <><span className="font-semibold text-discord-text">{typingUsers[0].username}</span> ve <span className="font-semibold text-discord-text">{typingUsers[1].username}</span> yazıyor...</>;
    return <><span className="font-semibold text-discord-text">{typingUsers.length} kişi</span> yazıyor...</>;
  };

  return (
    <div className="flex-1 flex flex-col bg-discord-medium min-w-0 overflow-hidden">
      {/* Header */}
      <div className="h-12 min-h-[48px] flex items-center px-4 shadow-md border-b border-discord-darker/50 z-10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {type === 'channel' ? (
            <>
              <Hash className="w-5 h-5 text-discord-text-muted flex-shrink-0" />
              <span className="font-semibold text-discord-text">{channel?.name || ''}</span>
              {channel?.topic && (
                <>
                  <div className="w-px h-6 bg-discord-separator mx-2 flex-shrink-0" />
                  <span className="text-sm text-discord-text-muted truncate">{channel.topic}</span>
                </>
              )}
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-discord-brand flex items-center justify-center flex-shrink-0">
                <AtSign className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-discord-text">{channelName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 text-discord-text-muted flex-shrink-0">
          {type === 'channel' && (
            <button
              onClick={onToggleMembers}
              className={`p-1 rounded hover:text-discord-text transition-colors ${showMembers ? 'text-discord-text' : ''}`}
              title="Üyeleri Göster/Gizle"
            >
              <Users className="w-5 h-5" />
            </button>
          )}
          <button className="p-1 rounded hover:text-discord-text transition-colors" title="Ara">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-1 rounded hover:text-discord-text transition-colors" title="Gelen Kutusu">
            <Inbox className="w-5 h-5" />
          </button>
          <button className="p-1 rounded hover:text-discord-text transition-colors" title="Yardım">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        setMessages={setMessages}
        channelName={channelName}
        type={type}
      />
      <div ref={messagesEndRef} />

      {/* Typing indicator */}
      <div className="px-4 h-6 flex items-center">
        {typingUsers.length > 0 && (
          <div className="text-xs text-discord-text-muted flex items-center gap-1">
            <span className="flex gap-0.5 mr-1">
              <span className="w-1 h-1 bg-discord-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-discord-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-discord-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {typingText()}
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        onSend={sendMessage}
        onTyping={handleTypingEmit}
        channelName={channelName}
        type={type}
      />
    </div>
  );
}
