import React from 'react';
import './CallMessage.css';

const CallMessage = ({ message }) => {
  const callData = message.message?.callLogMesssage || message.message?.callLogMessage;

  if (!callData) return null;

  const isVideo = callData.callType === 'video';
  const isIncoming = !message.key?.fromMe;
  const callOutcome = callData.callOutcome || 'completed';

  // Determine call status text
  let statusText = '';
  let duration = '';

  if (callOutcome === 'missed' || callOutcome === 'rejected') {
    statusText = 'Missed call';
  } else if (callOutcome === 'ongoing') {
    statusText = 'Ongoing';
  } else if (callOutcome === 'no_answer') {
    statusText = 'No answer';
  } else if (callData.duration) {
    // Call completed with duration
    const seconds = callData.duration;
    if (seconds < 60) {
      duration = `${seconds} sec`;
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      duration = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  } else {
    statusText = 'Call ended';
  }

  return (
    <div className="call-message">
      <div className="call-icon-container">
        {isVideo ? (
          <svg className="call-icon video" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        ) : (
          <svg className="call-icon voice" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
          </svg>
        )}
        <svg className={`call-direction ${isIncoming ? 'incoming' : 'outgoing'}`} viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d={isIncoming ? "M8 13V3m0 0L4 7m4-4l4 4" : "M8 3v10m0 0l-4-4m4 4l4-4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="call-info">
        <div className="call-type">{isVideo ? 'Video call' : 'Voice call'}</div>
        <div className="call-status">
          {isIncoming ? '↓ ' : '↑ '}
          {duration || statusText}
        </div>
      </div>
    </div>
  );
};

export default CallMessage;
