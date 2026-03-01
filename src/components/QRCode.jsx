import React, { useEffect, useState } from 'react';
import QRCodeSVG from 'react-qr-code';
import { evolutionApi } from '../services/evolutionApi';
import './QRCode.css';

const QRCode = ({ onConnected, onLogout }) => {
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQRCode();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchQRCode = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await evolutionApi.getQRCode();

      if (response.qrcode && response.qrcode.code) {
        setQrCode(response.qrcode.code);
      } else if (response.code) {
        setQrCode(response.code);
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load QR code. Make sure Evolution API is running.');
      setLoading(false);
      console.error('QR Code error:', err);
    }
  };

  const checkConnection = async () => {
    try {
      const status = await evolutionApi.getConnectionStatus();

      if (status.state === 'open' || status.instance?.state === 'open') {
        onConnected();
      }
    } catch (err) {
      console.error('Connection check error:', err);
    }
  };

  if (loading) {
    return (
      <div className="qr-container">
        <div className="qr-loading">
          <div className="spinner"></div>
          <p>Loading QR Code...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qr-container">
        <div className="qr-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchQRCode} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-container">
      <div className="qr-content">
        <div className="qr-header">
          <h1>WhatChat</h1>
          {onLogout && (
            <button onClick={onLogout} className="logout-btn-qr">Logout</button>
          )}
        </div>
        <p className="qr-subtitle">Scan QR code to connect WhatsApp</p>

        {qrCode && (
          <div className="qr-code-box">
            <QRCodeSVG value={qrCode} size={280} />
          </div>
        )}

        <div className="qr-instructions">
          <h3>How to connect:</h3>
          <ol>
            <li>Open WhatsApp on your phone</li>
            <li>Tap Menu or Settings and select Linked Devices</li>
            <li>Tap Link a Device</li>
            <li>Point your phone at this screen to scan the code</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default QRCode;
