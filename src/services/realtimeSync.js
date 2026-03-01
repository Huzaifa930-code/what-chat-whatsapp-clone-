import { indexedDBService } from './indexedDBService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Real-time sync service using Server-Sent Events (SSE)
 * Connects to backend webhook endpoint to receive real-time updates
 */
class RealtimeSync {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.listeners = {
      'message.new': [],
      'message.update': [],
      'message.delete': [],
      'connection.update': []
    };
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 30000;
  }

  /**
   * Connect to SSE endpoint
   */
  connect() {
    if (this.eventSource) {
      console.log('⚠️ Already connected to real-time sync');
      return;
    }

    console.log('🔌 Connecting to real-time sync...');

    try {
      this.eventSource = new EventSource(`${BACKEND_URL}/api/webhook/events`);

      this.eventSource.onopen = () => {
        console.log('✅ Connected to real-time sync');
        this.isConnected = true;
        this.reconnectDelay = 5000; // Reset reconnect delay
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        this.isConnected = false;

        // Close and attempt reconnect
        this.eventSource.close();
        this.eventSource = null;

        // Exponential backoff
        console.log(`⏳ Reconnecting in ${this.reconnectDelay / 1000}s...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
    }
  }

  /**
   * Disconnect from SSE
   */
  disconnect() {
    if (this.eventSource) {
      console.log('🔌 Disconnecting from real-time sync...');
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(data) {
    const { type } = data;

    console.log(`📨 Real-time event: ${type}`);

    switch (type) {
      case 'connected':
        console.log('✅ SSE connection established');
        break;

      case 'message.new':
        await this.handleNewMessage(data);
        break;

      case 'message.update':
        await this.handleMessageUpdate(data);
        break;

      case 'message.delete':
        await this.handleMessageDelete(data);
        break;

      case 'connection.update':
        this.handleConnectionUpdate(data);
        break;

      default:
        console.log(`Unknown event type: ${type}`);
    }
  }

  /**
   * Handle new message
   */
  async handleNewMessage(data) {
    const { chatId, message } = data;

    console.log(`  → New message in chat ${chatId}`);

    try {
      // Save to IndexedDB
      await indexedDBService.saveMessages(chatId, [message]);

      // Notify listeners
      this.notifyListeners('message.new', { chatId, message });

    } catch (error) {
      console.error('Failed to handle new message:', error);
    }
  }

  /**
   * Handle message status update
   */
  async handleMessageUpdate(data) {
    const { chatId, messageId, update } = data;

    console.log(`  → Message ${messageId} updated`);

    // Notify listeners
    this.notifyListeners('message.update', { chatId, messageId, update });
  }

  /**
   * Handle message deletion
   */
  async handleMessageDelete(data) {
    const { chatId, messageId } = data;

    console.log(`  → Message ${messageId} deleted`);

    try {
      // Mark as deleted in IndexedDB
      await indexedDBService.markMessageDeleted(messageId, chatId);

      // Notify listeners
      this.notifyListeners('message.delete', { chatId, messageId });

    } catch (error) {
      console.error('Failed to handle message deletion:', error);
    }
  }

  /**
   * Handle connection status update
   */
  handleConnectionUpdate(data) {
    const { state } = data;

    console.log(`  → Connection state: ${state}`);

    // Notify listeners
    this.notifyListeners('connection.update', { state });
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].push(callback);
      console.log(`✅ Registered listener for ${eventType}`);
    } else {
      console.warn(`Unknown event type: ${eventType}`);
    }
  }

  /**
   * Remove event listener
   */
  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify all listeners for an event
   */
  notifyListeners(eventType, data) {
    const callbacks = this.listeners[eventType] || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Listener error for ${eventType}:`, error);
      }
    });
  }
}

// Export singleton instance
export const realtimeSync = new RealtimeSync();
