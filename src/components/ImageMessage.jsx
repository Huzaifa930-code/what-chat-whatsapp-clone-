import React, { useState } from 'react';
import { evolutionApi } from '../services/evolutionApi';

function ImageMessage({ message, thumbnail }) {
  const [fullImage, setFullImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadFullImage = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    console.log('📷 Image clicked!');

    if (fullImage) {
      console.log('📷 Using cached image');
      setShowModal(true);
      return;
    }

    if (loading) {
      console.log('📷 Already loading...');
      return;
    }

    setLoading(true);
    console.log('📷 Downloading full image...');
    try {
      const result = await evolutionApi.downloadMedia(message.key.id);
      console.log('Image download result:', result);

      if (result?.base64) {
        const base64Data = result.base64.includes('base64,')
          ? result.base64.split(',')[1]
          : result.base64;
        const imageData = `data:${result.mimetype || 'image/jpeg'};base64,${base64Data}`;
        setFullImage(imageData);
        setShowModal(true);
        console.log('✅ Full image loaded and modal opened');
      } else {
        console.error('❌ No base64 data in response');
        alert('Failed to load image - no data');
      }
    } catch (error) {
      console.error('❌ Image load failed:', error);
      alert('Failed to load image: ' + error.message);
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
      <div
        className="image-message"
        onClick={loadFullImage}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        {thumbnail && (
          <img
            src={`data:image/jpeg;base64,${thumbnail}`}
            alt="Image preview"
            className="message-image thumbnail"
            style={{ display: 'block' }}
          />
        )}
        {/* Image icon overlay to differentiate from videos */}
        <div className="image-type-indicator" style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(0, 0, 0, 0.6)',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          pointerEvents: 'none'
        }}>
          📷
        </div>
        {loading && <div className="media-loading">Loading...</div>}
        {!loading && !fullImage && (
          <div className="media-overlay">Click to view</div>
        )}
      </div>

      {showModal && fullImage && (
        <div className="image-modal" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>
            <img src={fullImage} alt="Full size" className="modal-image" />
          </div>
        </div>
      )}
    </>
  );
}

export default ImageMessage;
