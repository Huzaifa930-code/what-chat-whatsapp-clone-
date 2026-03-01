import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { evolutionApi } from '../services/evolutionApi';
import { indexedDBService } from '../services/indexedDBService';
import ImageMessage from './ImageMessage';
import VideoMessage from './VideoMessage';
import CallMessage from './CallMessage';
import VoiceRecorder from './VoiceRecorder';
import './ChatWindow.css';

const ChatWindow = ({ chat }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null); // Track which audio is playing
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const previousScrollHeight = useRef(0);
  const chatIdRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const shouldScrollToBottomOnLoad = useRef(false); // Track if we should scroll when messages load

  // Load messages when chat changes
  useEffect(() => {
    if (chat) {
      const chatId = getChatId(chat);
      const isNewChat = chatIdRef.current !== chatId;

      if (isNewChat) {
        chatIdRef.current = chatId;
        setMessages([]);
        setCurrentPage(1);
        setHasMore(false);
        setShowEmojiPicker(false);
        // Set flag to scroll to bottom when messages load
        shouldScrollToBottomOnLoad.current = true;
        loadMessages(true);
      } else {
        // Just refresh messages without any scrolling
        loadMessages(false);
      }

      // Refresh messages every 10 seconds
      const interval = setInterval(() => {
        if (getChatId(chat) === chatId) {
          loadMessages(false);
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [chat]);

  // Scroll to bottom ONLY when opening a new chat (not on updates)
  useEffect(() => {
    if (shouldScrollToBottomOnLoad.current && messages.length > 0 && messagesContainerRef.current) {
      // Scroll to bottom to show latest messages
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      // Reset flag so subsequent updates don't auto-scroll
      shouldScrollToBottomOnLoad.current = false;
      console.log('📍 Scrolled to bottom for new chat');
    }
  }, [messages]);

  // DEBUG: Log message types to find call messages
  useEffect(() => {
    if (messages.length > 0) {
      console.log('====== MESSAGE DEBUG ======');
      console.log('Total messages:', messages.length);

      // Check for call messages with multiple possible keys
      const callMessages = messages.filter(msg =>
        msg.message?.callLogMessage ||
        msg.message?.callLogMesssage ||
        msg.message?.callMessage ||
        msg.messageType === 'call' ||
        msg.message?.call ||
        Object.keys(msg.message || {}).some(key => key.toLowerCase().includes('call'))
      );

      console.log('Found call messages:', callMessages.length);
      if (callMessages.length > 0) {
        console.log('Call messages:', callMessages);
      }

      // Show all unique message types
      const messageTypes = new Set();
      messages.forEach(msg => {
        const keys = Object.keys(msg.message || {});
        keys.forEach(key => messageTypes.add(key));
        if (msg.messageType) messageTypes.add(`type:${msg.messageType}`);
      });
      console.log('All message types in chat:', Array.from(messageTypes));

      // Show sample of first 5 messages structure
      console.log('First 5 messages structure:');
      messages.slice(0, 5).forEach((msg, i) => {
        console.log(`Message ${i}:`, {
          keys: Object.keys(msg.message || {}),
          messageType: msg.messageType,
          sample: msg
        });
      });

      // Show last 5 messages structure
      console.log('Last 5 messages structure:');
      messages.slice(-5).forEach((msg, i) => {
        console.log(`Message ${messages.length - 5 + i}:`, {
          keys: Object.keys(msg.message || {}),
          messageType: msg.messageType,
          sample: msg
        });
      });
    }
  }, [messages]);

  // Detect when user scrolls to top for Load More
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop } = messagesContainerRef.current;

    // Check if user scrolled to top for Load More
    if (scrollTop < 100 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
  };


  const getChatId = (chat) => {
    if (!chat) return null;
    return chat.remoteJid || chat.id || null;
  };

  const loadMessages = async (isInitialLoad = false) => {
    if (!chat) return;

    const chatId = getChatId(chat);
    if (!chatId) {
      console.error('Cannot load messages: invalid chat ID', chat);
      return;
    }

    console.log(`Loading messages for chat: ${chatId} (${getContactName(chat)})`);

    try {
      // STALE-WHILE-REVALIDATE PATTERN:
      // 1. Load from IndexedDB immediately (show cached messages)
      // 2. Fetch from API in background (refresh with latest)

      // Step 1: Load from cache immediately
      try {
        const cachedMessages = await indexedDBService.getMessages(chatId);
        if (cachedMessages && cachedMessages.length > 0) {
          console.log(`📦 Loaded ${cachedMessages.length} cached messages from IndexedDB`);
          setMessages(cachedMessages);
        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to load from cache:', cacheError);
      }

      // Step 2: Fetch fresh data from API (will fetch ALL messages via pagination)
      console.log(`🔄 Fetching COMPLETE message history from API...`);
      setLoading(true);
      const response = await evolutionApi.getMessages(chatId);

      // Double-check we're still on the same chat
      if (getChatId(chat) !== chatId) {
        console.log('Chat changed during message load, ignoring results');
        return;
      }

      console.log(`✅ Successfully loaded complete message history`);


      if (response && response.messages && Array.isArray(response.messages.records)) {
        const allRecords = response.messages.records;

        // Filter messages for this chat only
        const validMessages = allRecords.filter(msg => {
          const msgRemoteJid = msg.key?.remoteJid;
          return msgRemoteJid === chatId;
        });

        // Remove duplicates
        const seenIds = new Set();
        const uniqueMessages = validMessages.filter(msg => {
          const msgId = msg.key?.id;
          if (!msgId) return true;
          if (seenIds.has(msgId)) return false;
          seenIds.add(msgId);
          return true;
        });

        // Sort by timestamp
        const sortedMessages = uniqueMessages.sort((a, b) => {
          return (a.messageTimestamp || 0) - (b.messageTimestamp || 0);
        });

        console.log(`✅ Loaded ${sortedMessages.length} messages from API`);

        // Save to IndexedDB for next time
        await indexedDBService.saveMessages(chatId, sortedMessages);

        // Update React state with fresh messages
        setMessages(sortedMessages);
        setHasMore(false);

        // Log media count
        const mediaCount = {
          images: sortedMessages.filter(m => m.message?.imageMessage).length,
          videos: sortedMessages.filter(m => m.message?.videoMessage).length,
          documents: sortedMessages.filter(m => m.message?.documentMessage).length,
          audio: sortedMessages.filter(m => m.message?.audioMessage).length
        };
        console.log('📁 Media in chat:', mediaCount);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!chat || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      // Store current scroll position
      if (messagesContainerRef.current) {
        previousScrollHeight.current = messagesContainerRef.current.scrollHeight;
      }

      const response = await evolutionApi.getMessages(getChatId(chat), 10000, nextPage);
      if (response && response.messages && Array.isArray(response.messages.records)) {
        const newMessages = response.messages.records.sort((a, b) => {
          const timeA = a.messageTimestamp || 0;
          const timeB = b.messageTimestamp || 0;
          return timeA - timeB; // Ascending (oldest first)
        });

        // Prepend older messages to the beginning
        setMessages(prev => [...newMessages, ...prev]);
        setHasMore(response.messages.hasMore || false);
        setCurrentPage(nextPage);

        // Restore scroll position after new messages are added
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = newScrollHeight - previousScrollHeight.current;
          }
        }, 50);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chat) return;

    setLoading(true);
    try {
      await evolutionApi.sendMessage(getChatId(chat), newMessage);
      setNewMessage('');

      // Reload messages (no auto-scroll on refresh)
      setTimeout(() => {
        loadMessages(false);
      }, 500);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleSendAudio = async (audioBase64, duration) => {
    setLoading(true);
    setIsRecording(false);
    try {
      await evolutionApi.sendAudioMessage(getChatId(chat), audioBase64);

      // Reload messages (no auto-scroll on refresh)
      setTimeout(() => {
        loadMessages(false);
      }, 500);
    } catch (error) {
      console.error('Error sending audio message:', error);
      alert('Failed to send voice message');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRecording = () => {
    setIsRecording(false);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return '';

    const messageDate = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time to midnight for comparison
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayDateOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (messageDateOnly.getTime() === todayDateOnly.getTime()) {
      return 'Today';
    } else if (messageDateOnly.getTime() === yesterdayDateOnly.getTime()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const shouldShowDateHeader = (currentMsg, previousMsg) => {
    if (!currentMsg.messageTimestamp) return false;
    if (!previousMsg || !previousMsg.messageTimestamp) return true;

    const currentDate = new Date(currentMsg.messageTimestamp * 1000);
    const previousDate = new Date(previousMsg.messageTimestamp * 1000);

    // Compare dates (ignore time)
    return currentDate.toDateString() !== previousDate.toDateString();
  };

  const getContactName = (chat) => {
    if (!chat) return '';
    const chatId = getChatId(chat);

    // Check if it's a group (groups have @g.us)
    if (chatId && chatId.includes('@g.us')) {
      // For groups, prioritize pushName (set by API enrichment), then subject, then name
      return chat.pushName || chat.subject || chat.name || 'Group Chat';
    }

    // For individual chats, use pushName first, then name, then phone number
    return chat.pushName || chat.name || chatId.split('@')[0];
  };

  // Get ALL media files from current chat (complete history)
  const getAllMediaFromChat = () => {
    const mediaFiles = {
      images: [],
      videos: [],
      documents: [],
      audio: []
    };

    messages.forEach(msg => {
      const messageData = msg.message;

      // Images
      if (messageData?.imageMessage) {
        mediaFiles.images.push({
          id: msg.key?.id,
          timestamp: msg.messageTimestamp,
          thumbnail: messageData.imageMessage.jpegThumbnail,
          message: msg
        });
      }

      // Videos
      if (messageData?.videoMessage) {
        mediaFiles.videos.push({
          id: msg.key?.id,
          timestamp: msg.messageTimestamp,
          thumbnail: messageData.videoMessage.jpegThumbnail,
          mimetype: messageData.videoMessage.mimetype,
          message: msg
        });
      }

      // Documents
      if (messageData?.documentMessage) {
        mediaFiles.documents.push({
          id: msg.key?.id,
          timestamp: msg.messageTimestamp,
          fileName: messageData.documentMessage.fileName,
          fileLength: messageData.documentMessage.fileLength,
          message: msg
        });
      }

      // Audio
      if (messageData?.audioMessage) {
        mediaFiles.audio.push({
          id: msg.key?.id,
          timestamp: msg.messageTimestamp,
          duration: messageData.audioMessage.seconds,
          isPtt: messageData.audioMessage.ptt,
          message: msg
        });
      }
    });

    // Sort by timestamp (newest first for easier access)
    Object.keys(mediaFiles).forEach(key => {
      mediaFiles[key].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    });

    console.log('📁 Complete Media History:', {
      images: mediaFiles.images.length,
      videos: mediaFiles.videos.length,
      documents: mediaFiles.documents.length,
      audio: mediaFiles.audio.length,
      total: mediaFiles.images.length + mediaFiles.videos.length +
             mediaFiles.documents.length + mediaFiles.audio.length
    });

    return mediaFiles;
  };

  // Convert URLs in text to clickable links
  const linkifyText = (text) => {
    if (!text) return text;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="message-link"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const renderMessageContent = (msg) => {
    const messageData = msg.message;

    // DELETED MESSAGE - Check for protocol message indicating deletion
    if (messageData?.protocolMessage?.type === 0 ||
        messageData?.protocolMessage?.key ||
        (msg.messageStubType === 1 && msg.key?.fromMe)) {
      return (
        <div className="deleted-message" style={{
          fontStyle: 'italic',
          color: '#8696a0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🚫</span>
          <span>This message was deleted</span>
        </div>
      );
    }

    // Call message (both spellings - Evolution API might use either)
    if (messageData?.callLogMessage || messageData?.callLogMesssage) {
      return <CallMessage message={msg} />;
    }

    // Text message
    if (messageData?.conversation) {
      return <div className="text-message">{linkifyText(messageData.conversation)}</div>;
    }

    // Extended text message
    if (messageData?.extendedTextMessage?.text) {
      return <div className="text-message">{linkifyText(messageData.extendedTextMessage.text)}</div>;
    }

    // Audio/Voice message (PTT - Push to Talk)
    if (messageData?.audioMessage) {
      const isPtt = messageData.audioMessage.ptt;
      const duration = messageData.audioMessage.seconds || 0;
      const audioId = `audio-${msg.key?.id}`;
      const isPlaying = playingAudioId === audioId;

      const handlePlayAudio = async (e) => {
        e.stopPropagation(); // Prevent message click handler from firing
        console.log('🎤 Voice message clicked');
        console.log('Message key:', msg.key);

        const audioElement = document.getElementById(audioId);

        if (audioElement) {
          if (audioElement.paused) {
            // Stop any other playing audio
            if (playingAudioId && playingAudioId !== audioId) {
              const otherAudio = document.getElementById(playingAudioId);
              if (otherAudio) {
                otherAudio.pause();
              }
            }

            // Check if already has a valid src
            if (audioElement.src && audioElement.src.startsWith('blob:')) {
              try {
                await audioElement.play();
                setPlayingAudioId(audioId);
                console.log('✅ Playing cached audio');
                return;
              } catch (err) {
                console.log('Cached audio failed, re-downloading...');
              }
            }

            // Download audio via Evolution API
            console.log('Downloading audio via Evolution API...');
            try {
              const result = await evolutionApi.downloadMedia(msg.key.id);
              console.log('Evolution API response received');

              if (result?.base64) {
                console.log('Got base64 audio, creating blob...');
                // Remove data:audio/ogg;base64, prefix if present
                const base64Data = result.base64.includes(',')
                  ? result.base64.split(',')[1]
                  : result.base64;

                const binaryData = atob(base64Data);
                const bytes = new Uint8Array(binaryData.length);
                for (let i = 0; i < binaryData.length; i++) {
                  bytes[i] = binaryData.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: messageData.audioMessage.mimetype || 'audio/ogg; codecs=opus' });
                const url = URL.createObjectURL(blob);

                console.log('Blob created:', blob.size, 'bytes');
                audioElement.src = url;

                // Add event listeners for play/pause/ended
                audioElement.onplay = () => setPlayingAudioId(audioId);
                audioElement.onpause = () => setPlayingAudioId(null);
                audioElement.onended = () => setPlayingAudioId(null);

                await audioElement.play();
                console.log('✅ Audio playing');
              } else {
                console.error('❌ No base64 data in response');
                alert('Failed to load audio');
              }
            } catch (downloadErr) {
              console.error('❌ Media download failed:', downloadErr);
              alert('Failed to load audio: ' + downloadErr.message);
            }
          } else {
            console.log('Pausing audio');
            audioElement.pause();
            setPlayingAudioId(null);
          }
        }
      };

      return (
        <div className={`audio-message ${isPtt ? 'voice-note' : 'audio-file'}`} onClick={(e) => e.stopPropagation()}>
          <button className="play-button" onClick={handlePlayAudio}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div className="audio-waveform">
            <div className="waveform-bars">
              {[...Array(30)].map((_, i) => (
                <div key={i} className="bar" style={{ height: `${Math.random() * 100}%` }}></div>
              ))}
            </div>
          </div>
          <span className="audio-duration">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>
          <audio id={audioId} style={{ display: 'none' }} />
        </div>
      );
    }

    // Image message
    if (messageData?.imageMessage) {
      return (
        <ImageMessage
          message={msg}
          thumbnail={messageData.imageMessage.jpegThumbnail}
        />
      );
    }

    // Video message
    if (messageData?.videoMessage) {
      return (
        <VideoMessage
          message={msg}
          thumbnail={messageData.videoMessage.jpegThumbnail}
          mimetype={messageData.videoMessage.mimetype}
        />
      );
    }

    // Document message
    if (messageData?.documentMessage) {
      return (
        <div className="document-message">
          <div className="document-icon">📄</div>
          <div className="document-info">
            <div className="document-name">{messageData.documentMessage.fileName || 'Document'}</div>
            <div className="document-size">{messageData.documentMessage.fileLength ? `${(messageData.documentMessage.fileLength / 1024).toFixed(1)} KB` : ''}</div>
          </div>
        </div>
      );
    }

    // Sticker message
    if (messageData?.stickerMessage) {
      return (
        <div className="sticker-message">
          <img src={messageData.stickerMessage.url} alt="Sticker" className="message-sticker" />
        </div>
      );
    }


    // Default fallback - only show if there's actual content
    // Filter out empty/unknown messages
    const messageKeys = Object.keys(messageData || {});
    const hasContent = messageKeys.length > 0 && !messageKeys.every(key =>
      key === 'messageContextInfo' || key === 'messageStubType' || key === 'messageStubParameters'
    );

    if (!hasContent) {
      return null; // Don't render empty/phantom messages
    }

    return <div className="media-message">📎 {msg.messageType || 'Media message'}</div>;
  };

  if (!chat) {
    return (
      <div className="chat-window">
        <div className="no-chat-selected">
          <div className="no-chat-content">
            <h2>WhatChat</h2>
            <p>Select a chat to start messaging</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-header-info">
          <div className="chat-avatar-small">
            {chat.profilePicUrl ? (
              <img src={chat.profilePicUrl} alt={getContactName(chat)} />
            ) : (
              getContactName(chat).charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h3>{getContactName(chat)}</h3>
            <p className="status">online</p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn">🔍</button>
          <button className="icon-btn">⋮</button>
        </div>
      </div>

      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet</p>
            <p className="no-messages-subtitle">Send a message to start the conversation</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              // Skip reaction messages
              if (msg.message?.reactionMessage) return null;

              // Render content first to check if it's valid
              const content = renderMessageContent(msg);

              // Skip if no content (phantom/empty messages)
              if (!content) return null;

              // Check if we should show a date header
              const previousMsg = index > 0 ? messages[index - 1] : null;
              const showDateHeader = shouldShowDateHeader(msg, previousMsg);

              return (
                <React.Fragment key={`${msg.key?.id || index}-${msg.messageTimestamp || index}`}>
                  {showDateHeader && (
                    <div className="date-header" style={{
                      textAlign: 'center',
                      padding: '8px 12px',
                      margin: '20px auto 10px',
                      maxWidth: '200px',
                      backgroundColor: 'rgba(26, 35, 42, 0.9)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#8696a0',
                      fontWeight: '500'
                    }}>
                      {formatMessageDate(msg.messageTimestamp)}
                    </div>
                  )}
                  <div className={`message ${msg.key?.fromMe ? 'sent' : 'received'}`}>
                    <div className="message-content">
                      {content}
                      <span className="message-time">{formatTime(msg.messageTimestamp)}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {isRecording ? (
        <VoiceRecorder
          onSendAudio={handleSendAudio}
          onCancel={handleCancelRecording}
        />
      ) : (
        <form className="message-input-container" onSubmit={handleSendMessage}>
          {showEmojiPicker && (
            <div className="emoji-picker-wrapper" ref={emojiPickerRef}>
              <EmojiPicker
                onEmojiClick={(emojiObject) => {
                  setNewMessage(prev => prev + emojiObject.emoji);
                  setShowEmojiPicker(false);
                }}
                theme="dark"
                searchDisabled
                skinTonesDisabled
                height={400}
                width={350}
              />
            </div>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            😊
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message"
            className="message-input"
            disabled={loading}
          />
          {newMessage.trim() ? (
            <button type="submit" className="send-btn" disabled={loading}>
              {loading ? '⏳' : '➤'}
            </button>
          ) : (
            <button type="button" className="mic-btn" onClick={handleStartRecording} disabled={loading}>
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default ChatWindow;
