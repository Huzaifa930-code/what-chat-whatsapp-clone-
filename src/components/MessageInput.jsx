import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import './MessageInput.css';

function MessageInput({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage(prev => prev + emojiObject.emoji);
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <button
        type="button"
        className="emoji-button"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        disabled={disabled}
      >
        😊
      </button>

      {showEmojiPicker && (
        <div className="emoji-picker-container" ref={emojiPickerRef}>
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme="dark"
            searchDisabled
            skinTonesDisabled
            height={400}
            width={350}
          />
        </div>
      )}

      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
        disabled={disabled}
        className="message-input-field"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="message-send-button"
      >
        Send
      </button>
    </form>
  );
}

export default MessageInput;
