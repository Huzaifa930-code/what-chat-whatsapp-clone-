import React, { useState } from 'react';
import { evolutionApi } from '../services/evolutionApi';

function VideoMessage({ message, thumbnail, mimetype }) {
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadVideo = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    console.log('🎥 Video clicked!');

    if (videoData) {
      console.log('🎥 Using cached video');
      setShowModal(true);
      return;
    }

    if (loading) {
      console.log('🎥 Already loading...');
      return;
    }

    setLoading(true);
    console.log('🎥 Downloading video...');
    try {
      const result = await evolutionApi.downloadMedia(message.key.id);
      console.log('Video download result:', result);

      if (result?.base64) {
        const base64Data = result.base64.includes('base64,')
          ? result.base64.split(',')[1]
          : result.base64;

        // Convert base64 to blob for video
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.mimetype || mimetype || 'video/mp4' });
        const url = URL.createObjectURL(blob);

        setVideoData(url);
        setShowModal(true);
        console.log('✅ Video loaded and modal opened, size:', blob.size, 'bytes');
      } else {
        console.error('❌ No base64 data in response');
        alert('Failed to load video - no data');
      }
    } catch (error) {
      console.error('❌ Video load failed:', error);
      alert('Failed to load video: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = (e) => {
    e.stopPropagation();
    setShowModal(false);
  };

  return (
    <>
      <div className="video-message">
        <div
          className="video-thumbnail"
          onClick={loadVideo}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          {thumbnail && (
            <img
              src={`data:image/jpeg;base64,${thumbnail}`}
              alt="Video thumbnail"
              className="message-video-thumb"
              style={{ display: 'block' }}
            />
          )}
          {/* Video type indicator - distinct from images */}
          <div className="video-type-indicator" style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'white',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            🎥 VIDEO
          </div>
          {/* Large play button in center */}
          <div className="video-play-overlay" style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: 'white',
            pointerEvents: 'none'
          }}>
            {loading ? '⏳' : '▶️'}
          </div>
        </div>
      </div>

      {showModal && videoData && (
        <div className="video-modal" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>
            <video
              controls
              className="modal-video"
              autoPlay
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                width: 'auto',
                height: 'auto'
              }}
            >
              <source src={videoData} type={mimetype || 'video/mp4'} />
              {/* Fallback for different video formats */}
              <source src={videoData} type="video/mp4" />
              <source src={videoData} type="video/webm" />
              <source src={videoData} type="video/ogg" />
              Your browser does not support video playback.
            </video>
          </div>
        </div>
      )}
    </>
  );
}

export default VideoMessage;
