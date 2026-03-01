import express from 'express';

const router = express.Router();

// Store to track connected clients for real-time updates
const clients = new Set();

// SSE endpoint for frontend to connect and receive real-time updates
router.get('/events', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Add this client to the set
  clients.add(res);

  console.log(`✅ New SSE client connected (total: ${clients.size})`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Remove client on disconnect
  req.on('close', () => {
    clients.delete(res);
    console.log(`❌ SSE client disconnected (total: ${clients.size})`);
  });
});

// Webhook endpoint - Evolution API sends messages here
router.post('/evolution', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const { event, instance, data } = req.body;

    console.log(`\n📨 Webhook received:`);
    console.log(`   Event: ${event}`);
    console.log(`   Instance: ${instance}`);

    // Process different webhook events
    switch (event) {
      case 'messages.upsert':
        handleMessageUpsert(data);
        break;

      case 'messages.update':
        handleMessageUpdate(data);
        break;

      case 'messages.delete':
        handleMessageDelete(data);
        break;

      case 'connection.update':
        handleConnectionUpdate(data);
        break;

      default:
        console.log(`   Unknown event type: ${event}`);
    }

    // Respond to Evolution API
    res.status(200).json({ success: true, received: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle new messages
function handleMessageUpsert(data) {
  try {
    const messages = data.messages || [];
    console.log(`   📩 New messages: ${messages.length}`);

    messages.forEach(msg => {
      const chatId = msg.key?.remoteJid;
      const messageId = msg.key?.id;
      const fromMe = msg.key?.fromMe;

      console.log(`   → Message ${messageId} in chat ${chatId} (fromMe: ${fromMe})`);

      // Check if message is deleted (protocol message)
      const isDeleted = msg.message?.protocolMessage?.type === 0;
      if (isDeleted) {
        console.log(`   🗑️ Message is a deletion notice`);
      }

      // Broadcast to all connected SSE clients
      broadcastToClients({
        type: 'message.new',
        chatId,
        message: msg
      });
    });
  } catch (error) {
    console.error('Error handling message upsert:', error);
  }
}

// Handle message status updates (sent, delivered, read)
function handleMessageUpdate(data) {
  try {
    const updates = data.messages || [];
    console.log(`   🔄 Message updates: ${updates.length}`);

    updates.forEach(update => {
      const chatId = update.key?.remoteJid;
      const messageId = update.key?.id;

      console.log(`   → Status update for ${messageId}`);

      broadcastToClients({
        type: 'message.update',
        chatId,
        messageId,
        update
      });
    });
  } catch (error) {
    console.error('Error handling message update:', error);
  }
}

// Handle deleted messages
function handleMessageDelete(data) {
  try {
    const deletions = data.messages || [];
    console.log(`   🗑️ Message deletions: ${deletions.length}`);

    deletions.forEach(deletion => {
      const chatId = deletion.key?.remoteJid;
      const messageId = deletion.key?.id;

      console.log(`   → Delete message ${messageId} from chat ${chatId}`);

      broadcastToClients({
        type: 'message.delete',
        chatId,
        messageId
      });
    });
  } catch (error) {
    console.error('Error handling message delete:', error);
  }
}

// Handle connection status updates
function handleConnectionUpdate(data) {
  try {
    console.log(`   🔌 Connection status: ${data.state}`);

    broadcastToClients({
      type: 'connection.update',
      state: data.state
    });
  } catch (error) {
    console.error('Error handling connection update:', error);
  }
}

// Broadcast message to all connected SSE clients
function broadcastToClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;

  clients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Failed to send to client:', error);
      clients.delete(client);
    }
  });

  if (clients.size > 0) {
    console.log(`   📡 Broadcast to ${clients.size} connected client(s)`);
  }
}

export default router;
