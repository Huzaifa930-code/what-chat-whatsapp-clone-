import React, { useState, useMemo } from 'react';
import './ChatList.css';

const ChatList = ({ chats, selectedChat, onSelectChat, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPhoneNumber = (jid) => {
    if (!jid) return 'Unknown';
    const number = jid.split('@')[0];
    return number;
  };

  const getContactName = (chat) => {
    const jid = chat.remoteJid || chat.id;

    // Check if it's a group (groups have @g.us)
    if (jid && jid.includes('@g.us')) {
      // For groups, prioritize pushName (set by API enrichment), then subject, then name
      return chat.pushName || chat.subject || chat.name || 'Group Chat';
    }

    // For individual chats, use pushName first, then name, then phone number
    return chat.pushName || chat.name || formatPhoneNumber(jid);
  };

  const getChatId = (chat) => {
    return chat.remoteJid || chat.id;
  };

  const getLastMessageTime = (chat) => {
    return chat.updatedAt ? new Date(chat.updatedAt).getTime() / 1000 : 0;
  };

  // Filter chats based on search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) {
      return chats;
    }

    const query = searchQuery.toLowerCase();
    return chats.filter(chat => {
      const name = getContactName(chat).toLowerCase();
      const phoneNumber = formatPhoneNumber(chat.remoteJid || chat.id);
      return name.includes(query) || phoneNumber.includes(query);
    });
  }, [chats, searchQuery]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h2>Chats</h2>
        <div className="header-icons">
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
          <button className="icon-btn" title="New chat">+</button>
        </div>
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search or start new chat"
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="chats-container">
        {filteredChats.length === 0 ? (
          <div className="no-chats">
            <p>{searchQuery ? 'No chats found' : 'No chats yet'}</p>
            <p className="no-chats-subtitle">
              {searchQuery ? 'Try a different search' : 'Start a conversation'}
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={getChatId(chat)}
              className={`chat-item ${selectedChat && getChatId(selectedChat) === getChatId(chat) ? 'active' : ''}`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="chat-avatar">
                {chat.profilePicUrl ? (
                  <img src={chat.profilePicUrl} alt={getContactName(chat)} />
                ) : (
                  getContactName(chat).charAt(0).toUpperCase()
                )}
              </div>
              <div className="chat-info">
                <div className="chat-header-row">
                  <h3 className="chat-name">{getContactName(chat)}</h3>
                  <span className="chat-time">
                    {formatTime(getLastMessageTime(chat))}
                  </span>
                </div>
                <div className="chat-preview-row">
                  <p className="chat-preview">
                    {chat.lastMessage?.message || 'Tap to view messages'}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="unread-badge">{chat.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatList;
