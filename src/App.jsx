import React, { useState, useEffect } from 'react';
import QRCode from './components/QRCode';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import Login from './components/Login';
import Signup from './components/Signup';
import { evolutionApi } from './services/evolutionApi';
import { realtimeSync } from './services/realtimeSync';
import './App.css';

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  // WhatsApp state
  const [isConnected, setIsConnected] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      checkConnection();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isConnected) {
      loadChats();
      // Refresh chats every 30 seconds instead of 5 to reduce flicker
      const interval = setInterval(loadChats, 30000);

      // Configure webhook and start real-time sync
      initializeRealtimeSync();

      return () => {
        clearInterval(interval);
        realtimeSync.disconnect();
      };
    }
  }, [isConnected]);

  // Initialize real-time sync
  const initializeRealtimeSync = async () => {
    try {
      // Configure webhook in Evolution API
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
      const webhookUrl = `${backendUrl}/api/webhook/evolution`;

      console.log('🔗 Configuring Evolution API webhook...');
      await evolutionApi.configureWebhook(webhookUrl);

      // Connect to SSE endpoint
      realtimeSync.connect();

      // Listen for new messages
      realtimeSync.on('message.new', ({ chatId, message }) => {
        console.log('📩 New message received via webhook:', chatId);
        // Refresh the chat list to show new message
        loadChats();
      });

    } catch (error) {
      console.error('Failed to initialize real-time sync:', error);
    }
  };


  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setIsConnected(false);
    setChats([]);
    setSelectedChat(null);
  };

  const checkConnection = async () => {
    try {
      const status = await evolutionApi.getConnectionStatus();
      if (status.state === 'open' || status.instance?.state === 'open') {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChats = async () => {
    try {
      const response = await evolutionApi.getChats();
      let chatList = [];

      if (Array.isArray(response)) {
        chatList = response;
      } else if (response.chats && Array.isArray(response.chats)) {
        chatList = response.chats;
      }

      // Filter out chats that might be deleted/invalid
      // Keep chats that have valid remoteJid and are not marked as deleted
      const validChats = chatList.filter(chat => {
        const hasValidId = chat.remoteJid || chat.id;
        // Skip chats without proper IDs
        if (!hasValidId) return false;

        // You can add more filtering logic here if Evolution API provides
        // deletion/leave status fields
        return true;
      });

      // Sort chats by most recent first (like WhatsApp)
      const sortedChats = validChats.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA; // Descending (most recent first)
      });

      console.log(`Loaded ${sortedChats.length} valid chats (filtered from ${chatList.length})`);
      setChats(sortedChats);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const handleConnected = () => {
    setIsConnected(true);
    loadChats();
  };

  const handleSelectChat = (chat) => {
    console.log('✅ Chat selected:', chat);
    setSelectedChat(chat);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show auth screens if not authenticated
  if (!isAuthenticated) {
    if (showSignup) {
      return <Signup onSignup={handleLogin} onSwitchToLogin={() => setShowSignup(false)} />;
    }
    return <Login onLogin={handleLogin} onSwitchToSignup={() => setShowSignup(true)} />;
  }

  // Show QR code if authenticated but not connected to WhatsApp
  if (!isConnected) {
    return <QRCode onConnected={handleConnected} onLogout={handleLogout} />;
  }

  console.log('App render - selectedChat:', selectedChat);

  return (
    <div className="app">
      <div className="app-content">
        <ChatList
          chats={chats}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onLogout={handleLogout}
        />
        <ChatWindow chat={selectedChat} />
      </div>
    </div>
  );
}

export default App;
