import { evolutionApi } from './evolutionApi';
import { indexedDBService } from './indexedDBService';

/**
 * Batch Media Downloader
 * Downloads images, videos, and documents with rate limiting
 */
class MediaDownloader {
  constructor() {
    this.downloadQueue = [];
    this.isProcessing = false;
    this.batchSize = 10;
    this.delayBetweenBatches = 1000; // 1 second
    this.onProgress = null;
  }

  /**
   * Extract all media messages from a chat
   */
  extractMediaMessages(messages) {
    const mediaMessages = [];

    messages.forEach(msg => {
      const messageData = msg.message;
      const messageId = msg.key?.id;

      if (!messageId) return;

      // Image messages
      if (messageData?.imageMessage) {
        mediaMessages.push({
          messageId,
          type: 'image',
          message: msg,
          thumbnail: messageData.imageMessage.jpegThumbnail
        });
      }

      // Video messages
      if (messageData?.videoMessage) {
        mediaMessages.push({
          messageId,
          type: 'video',
          message: msg,
          thumbnail: messageData.videoMessage.jpegThumbnail,
          mimetype: messageData.videoMessage.mimetype
        });
      }

      // Document messages
      if (messageData?.documentMessage) {
        mediaMessages.push({
          messageId,
          type: 'document',
          message: msg,
          fileName: messageData.documentMessage.fileName
        });
      }
    });

    console.log(`📁 Extracted ${mediaMessages.length} media items:`, {
      images: mediaMessages.filter(m => m.type === 'image').length,
      videos: mediaMessages.filter(m => m.type === 'video').length,
      documents: mediaMessages.filter(m => m.type === 'document').length
    });

    return mediaMessages;
  }

  /**
   * Download all media for a chat in batches
   */
  async downloadChatMedia(chatId, messages, onProgress) {
    this.onProgress = onProgress;

    const mediaMessages = this.extractMediaMessages(messages);

    if (mediaMessages.length === 0) {
      console.log('✅ No media to download');
      return { downloaded: 0, cached: 0, failed: 0 };
    }

    console.log(`⬇️ Starting batch download for ${mediaMessages.length} media items...`);

    const stats = {
      downloaded: 0,
      cached: 0,
      failed: 0,
      total: mediaMessages.length
    };

    // Process in batches
    for (let i = 0; i < mediaMessages.length; i += this.batchSize) {
      const batch = mediaMessages.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(mediaMessages.length / this.batchSize);

      console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

      // Download batch in parallel
      const batchResults = await Promise.all(
        batch.map(media => this.downloadMediaItem(chatId, media))
      );

      // Update stats
      batchResults.forEach(result => {
        if (result.cached) stats.cached++;
        else if (result.success) stats.downloaded++;
        else stats.failed++;
      });

      // Report progress
      if (this.onProgress) {
        this.onProgress({
          current: Math.min(i + this.batchSize, mediaMessages.length),
          total: mediaMessages.length,
          stats
        });
      }

      // Wait between batches (rate limiting)
      if (i + this.batchSize < mediaMessages.length) {
        console.log(`⏳ Waiting ${this.delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    console.log(`\n✅ Download complete:`, stats);
    return stats;
  }

  /**
   * Download a single media item
   */
  async downloadMediaItem(chatId, mediaItem) {
    const { messageId, type } = mediaItem;

    try {
      // Check if already cached
      const cached = await indexedDBService.getMedia(messageId);
      if (cached) {
        console.log(`  ✓ ${type} ${messageId.substring(0, 10)}... (cached)`);
        return { success: true, cached: true };
      }

      // Download from Evolution API
      const mediaData = await evolutionApi.downloadMedia(messageId);

      if (!mediaData || !mediaData.base64) {
        console.error(`  ✗ ${type} ${messageId.substring(0, 10)}... (no data)`);
        return { success: false, cached: false };
      }

      // Save to IndexedDB
      await indexedDBService.saveMedia(messageId, chatId, {
        base64: mediaData.base64,
        mimetype: mediaData.mimetype || mediaItem.mimetype
      });

      console.log(`  ↓ ${type} ${messageId.substring(0, 10)}... (downloaded)`);
      return { success: true, cached: false };

    } catch (error) {
      console.error(`  ✗ ${type} ${messageId.substring(0, 10)}... (error: ${error.message})`);
      return { success: false, cached: false };
    }
  }

  /**
   * Download a single media item immediately (for on-demand loading)
   */
  async downloadSingleMedia(messageId, chatId) {
    try {
      // Check cache first
      const cached = await indexedDBService.getMedia(messageId);
      if (cached) {
        return cached;
      }

      // Download from API
      const mediaData = await evolutionApi.downloadMedia(messageId);

      if (mediaData && mediaData.base64) {
        // Save to cache
        await indexedDBService.saveMedia(messageId, chatId, {
          base64: mediaData.base64,
          mimetype: mediaData.mimetype
        });

        return mediaData;
      }

      return null;
    } catch (error) {
      console.error('Failed to download media:', error);
      return null;
    }
  }
}

// Export singleton instance
export const mediaDownloader = new MediaDownloader();
