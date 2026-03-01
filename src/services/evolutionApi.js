import axios from 'axios';

const BACKEND_API_URL = import.meta.env.VITE_API_URL;

// Use backend proxy for multi-user isolation
// This ensures each user connects to their own Evolution API instance
const api = axios.create({
  baseURL: `${BACKEND_API_URL}/evolution/proxy`,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Include auth token in requests
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cache for instance name to avoid repeated API calls
let cachedInstanceName = null;

export const evolutionApi = {
  // Get user's Evolution instance info from backend
  async getUserInstance() {
    try {
      const response = await axios.get(`${BACKEND_API_URL}/evolution/instance`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error getting user instance:', error);
      throw error;
    }
  },

  // Get instance name (cached)
  async getInstanceName() {
    if (cachedInstanceName) {
      return cachedInstanceName;
    }
    const instanceInfo = await this.getUserInstance();
    if (!instanceInfo.hasInstance) {
      throw new Error('No Evolution instance found for user');
    }
    cachedInstanceName = instanceInfo.instance.name;
    return cachedInstanceName;
  },

  // Clear instance cache (call on logout)
  clearInstanceCache() {
    cachedInstanceName = null;
  },

  // Configure webhook for real-time updates
  async configureWebhook(webhookUrl, instanceName) {
    try {
      console.log(`🔗 Configuring webhook: ${webhookUrl}`);

      const response = await api.post(`/webhook/set/${instanceName}`, {
        enabled: true,
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'CONNECTION_UPDATE'
        ]
      });

      console.log('✅ Webhook configured successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to configure webhook:', error.message);
      throw error;
    }
  },

  // Get connection status
  async getConnectionStatus() {
    try {
      const instanceName = await this.getInstanceName();
      const response = await api.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Error getting connection status:', error);
      throw error;
    }
  },

  // Get QR code
  async getQRCode() {
    try {
      const instanceName = await this.getInstanceName();
      const response = await api.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Error getting QR code:', error);
      throw error;
    }
  },

  // Get contacts
  async getContacts() {
    try {
      const instanceName = await this.getInstanceName();
      const response = await api.post(`/chat/findContacts/${instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  },

  // Get all groups with proper metadata and retry logic
  async getGroups() {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // CRITICAL: Check connection state BEFORE fetching groups
        console.log(`🔌 Checking connection state before fetching groups (attempt ${attempt}/${maxRetries})...`);
        const connectionState = await this.getConnectionStatus();

        if (connectionState.state !== 'open') {
          console.warn(`⚠️ Connection not ready: ${connectionState.state}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
            continue;
          }
          throw new Error(`Connection not open: ${connectionState.state}`);
        }

        console.log(`✅ Connection is open, fetching groups...`);

        // Use correct GET endpoint with apikey header (already in axios instance)
        const instanceName = await this.getInstanceName();
        const response = await api.get(`/group/fetchAllGroups/${instanceName}`, {
          params: {
            getParticipants: false
          },
          timeout: 10000 // 10 second timeout
        });

        console.log(`✅ Successfully fetched groups on attempt ${attempt}`);
        return response.data;

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);

        if (attempt < maxRetries) {
          const waitTime = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
          console.log(`⏳ Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.error(`❌ All ${maxRetries} attempts failed for fetchAllGroups`);
    throw lastError;
  },

  // Get all chats with contact name enrichment
  async getChats() {
    try {
      const instanceName = await this.getInstanceName();
      const chats = (await api.post(`/chat/findChats/${instanceName}`)).data;
      console.log(`📋 Fetched ${chats.length} chats`);

      // Fetch group metadata
      let groupsMap = {};
      try {
        const groupsResponse = await this.getGroups();
        console.log('🔍 Groups API raw response:', JSON.stringify(groupsResponse).substring(0, 200));

        // Evolution API returns array directly
        let groupsArray = Array.isArray(groupsResponse) ? groupsResponse : [];

        console.log(`📊 Groups array length: ${groupsArray.length}`);

        if (groupsArray.length > 0) {
          console.log('First group structure:', JSON.stringify(groupsArray[0], null, 2));
        }

        groupsArray.forEach((group) => {
          // Evolution API uses 'id' for group JID and 'subject' for name
          const groupJid = group.id;
          const groupSubject = group.subject;

          if (groupJid && groupSubject) {
            console.log(`✅ Mapping group: ${groupJid} -> "${groupSubject}"`);
            groupsMap[groupJid] = {
              ...group,
              name: groupSubject,
              subject: groupSubject
            };
          } else {
            console.warn(`⚠️ Group missing id or subject:`, group);
          }
        });

        console.log(`✅ Mapped ${Object.keys(groupsMap).length} groups`);
      } catch (err) {
        console.error('⚠️ Failed to fetch groups via API:', err.message);
        console.log('📝 Will attempt to extract group names from chat metadata instead');
      }

      // Fetch contacts
      let contactsMap = {};
      try {
        const contactsResponse = await this.getContacts();
        let contactsArray = Array.isArray(contactsResponse) ? contactsResponse :
                           (contactsResponse?.contacts || []);

        contactsArray.forEach((contact) => {
          if (contact.id) {
            contactsMap[contact.id] = contact;
          }
        });
      } catch (err) {
        console.error('Failed to fetch contacts:', err.message);
      }

      // Enrich chats
      const enrichedChats = await Promise.all(
        chats.map(async (chat) => {
          const isGroup = chat.remoteJid?.includes('@g.us');

          // Handle groups - PRIORITIZE API group data
          if (isGroup) {
            const groupData = groupsMap[chat.remoteJid];

            if (groupData && groupData.subject) {
              // Use group name from Evolution API (most reliable)
              console.log(`✅ Using API group name for ${chat.remoteJid}: "${groupData.subject}"`);
              return {
                ...chat,
                pushName: groupData.subject,
                name: groupData.subject,
                subject: groupData.subject,
                isGroup: true
              };
            }

            // Fallback to chat metadata (less reliable)
            const groupName = chat.subject || chat.name;

            if (groupName) {
              console.log(`⚠️ Using fallback name for ${chat.remoteJid}: "${groupName}"`);
              return {
                ...chat,
                pushName: groupName,
                name: groupName,
                subject: groupName,
                isGroup: true
              };
            }

            // If still no name found, try fetching from group metadata as last resort
            console.log(`⚠️ No subject found for group ${chat.remoteJid}, trying direct fetch`);
            try {
              const groupInfo = await api.get(`/group/findGroupInfo/${instanceName}`, {
                params: { groupJid: chat.remoteJid }
              });
              const fetchedName = groupInfo.data?.subject || groupInfo.data?.name;
              if (fetchedName) {
                console.log(`✅ Retrieved group name via direct fetch: ${fetchedName}`);
                return {
                  ...chat,
                  pushName: fetchedName,
                  name: fetchedName,
                  subject: fetchedName
                };
              }
            } catch (fetchErr) {
              console.error(`Failed to fetch group info for ${chat.remoteJid}:`, fetchErr.message);
            }

            // Ultimate fallback: use a formatted version of the JID
            console.log(`❌ Using fallback name for group ${chat.remoteJid}`);
            return {
              ...chat,
              pushName: `Group ${chat.remoteJid.split('@')[0].slice(-8)}`,
              name: `Group ${chat.remoteJid.split('@')[0].slice(-8)}`
            };
          }

          // Handle contacts
          const contact = contactsMap[chat.remoteJid];
          if (contact) {
            const contactName = contact.name || contact.notify || contact.verifiedName || chat.pushName;
            if (contactName?.trim()) {
              return {
                ...chat,
                pushName: contactName,
                name: contactName
              };
            }
          }

          // Fallback to existing pushName
          if (chat.pushName?.trim()) {
            return chat;
          }

          // Last resort: fetch from messages
          try {
            const messagesResponse = await api.post(`/chat/findMessages/${instanceName}`, {
              where: { key: { remoteJid: chat.remoteJid } },
              limit: 20,
              page: 1
            });

            const messages = messagesResponse.data.messages?.records || [];
            const messageWithName = messages.find(msg =>
              msg.key?.fromMe === false && msg.pushName?.trim()
            );

            if (messageWithName) {
              return {
                ...chat,
                pushName: messageWithName.pushName,
                name: messageWithName.pushName
              };
            }
          } catch (err) {
            console.error(`Failed to fetch messages for ${chat.remoteJid}:`, err.message);
          }

          return chat;
        })
      );

      return enrichedChats;
    } catch (error) {
      console.error('Error getting chats:', error);
      throw error;
    }
  },

  // Get messages from a chat - with STRICT filtering and FULL pagination
  async getMessages(remoteJid, limit = 100, page = 1) {
    try {
      console.log(`═══════════════════════════════════════════════`);
      console.log(`🌐 REQUESTING FULL HISTORY for: ${remoteJid}`);
      console.log(`═══════════════════════════════════════════════`);

      const instanceName = await this.getInstanceName();

      // Use smaller page size (100) for reliable pagination
      const firstResponse = await api.post(`/chat/findMessages/${instanceName}`, {
        where: { key: { remoteJid } },
        limit: 100,  // Use smaller page size for reliability
        page: 1
      });

      const apiMessages = firstResponse.data.messages?.records || [];
      console.log(`📨 Evolution API returned ${apiMessages.length} messages`);

      // Log the first few messages to see what remoteJid they have
      if (apiMessages.length > 0) {
        console.log(`🔍 First 3 messages remoteJid values:`);
        apiMessages.slice(0, 3).forEach((msg, idx) => {
          console.log(`  [${idx}] ${msg.key?.remoteJid}`);
        });
      }

      const totalPages = firstResponse.data.messages?.pages || 1;
      const totalCount = firstResponse.data.messages?.total || 0;
      console.log(`📄 Total pages: ${totalPages}`);
      console.log(`📊 Total messages available in Evolution API: ${totalCount}`);

      let allMessages = [...apiMessages];

      // Fetch remaining pages (use smaller batches to avoid overwhelming the API)
      if (totalPages > 1) {
        console.log(`⏳ Fetching remaining ${totalPages - 1} pages...`);

        // Fetch pages in batches of 5 to avoid overwhelming the API
        const batchSize = 5;
        for (let startPage = 2; startPage <= totalPages; startPage += batchSize) {
          const endPage = Math.min(startPage + batchSize - 1, totalPages);
          console.log(`📦 Fetching batch: pages ${startPage}-${endPage}`);

          const pagePromises = [];
          for (let p = startPage; p <= endPage; p++) {
            pagePromises.push(
              api.post(`/chat/findMessages/${instanceName}`, {
                where: { key: { remoteJid } },
                limit: 100,
                page: p
              })
            );
          }

          const pageResults = await Promise.all(pagePromises);
          pageResults.forEach((result, idx) => {
            const pageMessages = result.data.messages?.records || [];
            console.log(`📄 Page ${startPage + idx}: ${pageMessages.length} messages`);
            allMessages.push(...pageMessages);
          });

          // Small delay between batches to be nice to the API
          if (endPage < totalPages) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      console.log(`📦 Total messages before filtering: ${allMessages.length}`);

      // CRITICAL: Strictly filter messages - ONLY exact remoteJid matches
      const filteredMessages = allMessages.filter(msg => {
        const msgJid = msg.key?.remoteJid;
        const isExactMatch = msgJid === remoteJid;

        if (!isExactMatch && msgJid) {
          console.warn(`⚠️  FILTERING OUT: Message from ${msgJid} (wanted ${remoteJid})`);
        }

        return isExactMatch;
      });

      console.log(`✅ Messages after strict filtering: ${filteredMessages.length}`);
      console.log(`🗑️  Filtered out: ${allMessages.length - filteredMessages.length} wrong messages`);

      // Sort by timestamp (oldest first)
      filteredMessages.sort((a, b) => {
        const timeA = a.messageTimestamp || 0;
        const timeB = b.messageTimestamp || 0;
        return timeA - timeB;
      });

      // Log unique remoteJids in filtered messages
      const uniqueJids = [...new Set(filteredMessages.map(m => m.key?.remoteJid))];
      console.log(`📊 Unique remoteJids in result: ${uniqueJids.length}`);
      uniqueJids.forEach(jid => console.log(`   - ${jid}`));
      console.log(`═══════════════════════════════════════════════\n`);

      return {
        messages: {
          total: filteredMessages.length,
          pages: 1,
          currentPage: 1,
          records: filteredMessages,
          hasMore: false
        }
      };
    } catch (error) {
      console.error('❌ Error getting messages:', error);
      throw error;
    }
  },

  // Send text message
  async sendMessage(number, message) {
    try {
      const instanceName = await this.getInstanceName();
      const response = await api.post(`/message/sendText/${instanceName}`, {
        number,
        text: message
      });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Send audio message
  async sendAudioMessage(number, audioBase64) {
    try {
      const instanceName = await this.getInstanceName();
      const response = await api.post(`/message/sendAudio/${instanceName}`, {
        number,
        audioMessage: { audio: audioBase64 },
        options: { encoding: true }
      });
      return response.data;
    } catch (error) {
      console.error('Error sending audio message:', error);
      throw error;
    }
  },

  // Download media
  async downloadMedia(messageId) {
    try {
      const instanceName = await this.getInstanceName();
      const response = await api.post(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: {
          key: { id: messageId }
        },
        convertToMp4: false
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading media:', error);
      return null;
    }
  },

  // Logout instance
  async logout() {
    try {
      const instanceName = await this.getInstanceName();
      const response = await api.delete(`/instance/logout/${instanceName}`);
      this.clearInstanceCache(); // Clear cache on logout
      return response.data;
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }
};
