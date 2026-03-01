import React, { useState, useRef, useEffect } from 'react';
import './VoiceRecorder.css';

const VoiceRecorder = ({ onSendAudio, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    // Start recording automatically when component mounts
    startRecording();

    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please grant permission.');
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleCancel = () => {
    stopRecording();
    onCancel();
  };

  const handleSend = async () => {
    if (!audioBlob) {
      stopRecording();
      // Wait a bit for the blob to be created
      setTimeout(async () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
          await sendAudioBlob(blob);
        }
      }, 100);
    } else {
      await sendAudioBlob(audioBlob);
    }
  };

  const sendAudioBlob = async (blob) => {
    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result;
      onSendAudio(base64Audio, recordingTime);
    };
    reader.readAsDataURL(blob);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder">
      <button className="cancel-btn" onClick={handleCancel} title="Cancel">
        ✕
      </button>

      <div className="recording-indicator">
        <div className="recording-dot"></div>
        <span className="recording-time">{formatTime(recordingTime)}</span>
      </div>

      <div className="waveform-animation">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="wave-bar"
            style={{
              animationDelay: `${i * 0.05}s`,
              height: '10px'
            }}
          ></div>
        ))}
      </div>

      <button className="send-voice-btn" onClick={handleSend} title="Send">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/>
        </svg>
      </button>
    </div>
  );
};

export default VoiceRecorder;
