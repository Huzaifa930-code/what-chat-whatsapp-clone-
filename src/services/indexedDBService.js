// IndexedDB service for message persistence
const DB_NAME = 'WhatChatDB';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';
const MEDIA_STORE = 'media';
const CHATS_STORE = 'chats';

class IndexedDBService {
  constructor() {
    this.db = null;
  }

  // Initialize database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Messages store
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          messagesStore.createIndex('chatId', 'chatId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
          messagesStore.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
          console.log('📦 Created messages store');
        }

        // Media store
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: 'messageId' });
          mediaStore.createIndex('chatId', 'chatId', { unique: false });
          console.log('📦 Created media store');
        }

        // Chats store
        if (!db.objectStoreNames.contains(CHATS_STORE)) {
          const chatsStore = db.createObjectStore(CHATS_STORE, { keyPath: 'remoteJid' });
          chatsStore.createIndex('lastMessageTime', 'lastMessageTime', { unique: false });
          console.log('📦 Created chats store');
        }
      };
    });
  }

  // Save messages to IndexedDB
  async saveMessages(chatId, messages) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);

      let savedCount = 0;
      let errorCount = 0;

      messages.forEach(msg => {
        const messageData = {
          id: msg.key?.id || `${chatId}_${msg.messageTimestamp}`,
          chatId: chatId,
          timestamp: msg.messageTimestamp || Date.now(),
          data: msg,
          isDeleted: msg.message?.protocolMessage?.type === 0 || false
        };

        const request = store.put(messageData);
        request.onsuccess = () => savedCount++;
        request.onerror = () => {
          console.error('Failed to save message:', msg.key?.id);
          errorCount++;
        };
      });

      transaction.oncomplete = () => {
        console.log(`💾 Saved ${savedCount} messages to IndexedDB for chat ${chatId}`);
        resolve(savedCount);
      };

      transaction.onerror = () => {
        console.error('❌ Transaction error:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // Get messages from IndexedDB
  async getMessages(chatId, limit = 1000) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index('chatId_timestamp');

      const range = IDBKeyRange.bound([chatId, 0], [chatId, Infinity]);
      const request = index.openCursor(range, 'prev'); // Get newest first

      const messages = [];
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor && count < limit) {
          messages.push(cursor.value.data);
          count++;
          cursor.continue();
        } else {
          // Reverse to get oldest first (chronological order)
          messages.reverse();
          console.log(`📥 Loaded ${messages.length} messages from IndexedDB for chat ${chatId}`);
          resolve(messages);
        }
      };

      request.onerror = () => {
        console.error('❌ Failed to get messages:', request.error);
        reject(request.error);
      };
    });
  }

  // Mark message as deleted
  async markMessageDeleted(messageId, chatId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);

      const request = store.get(messageId);

      request.onsuccess = () => {
        const message = request.result;
        if (message) {
          message.isDeleted = true;
          message.data.message = {
            protocolMessage: { type: 0 }
          };

          const updateRequest = store.put(message);
          updateRequest.onsuccess = () => {
            console.log(`🗑️ Marked message ${messageId} as deleted`);
            resolve(true);
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          console.warn(`⚠️ Message ${messageId} not found in IndexedDB`);
          resolve(false);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Save media to IndexedDB
  async saveMedia(messageId, chatId, mediaData) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE], 'readwrite');
      const store = transaction.objectStore(MEDIA_STORE);

      const data = {
        messageId,
        chatId,
        base64: mediaData.base64,
        mimetype: mediaData.mimetype,
        savedAt: Date.now()
      };

      const request = store.put(data);

      request.onsuccess = () => {
        console.log(`💾 Saved media for message ${messageId}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error('❌ Failed to save media:', request.error);
        reject(request.error);
      };
    });
  }

  // Get media from IndexedDB
  async getMedia(messageId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE], 'readonly');
      const store = transaction.objectStore(MEDIA_STORE);
      const request = store.get(messageId);

      request.onsuccess = () => {
        if (request.result) {
          console.log(`📥 Loaded media for message ${messageId} from cache`);
          resolve(request.result);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ Failed to get media:', request.error);
        reject(request.error);
      };
    });
  }

  // Clear all data (for logout)
  async clearAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE, MEDIA_STORE, CHATS_STORE], 'readwrite');

      transaction.objectStore(MESSAGES_STORE).clear();
      transaction.objectStore(MEDIA_STORE).clear();
      transaction.objectStore(CHATS_STORE).clear();

      transaction.oncomplete = () => {
        console.log('🗑️ Cleared all IndexedDB data');
        resolve(true);
      };

      transaction.onerror = () => {
        console.error('❌ Failed to clear data:', transaction.error);
        reject(transaction.error);
      };
    });
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
