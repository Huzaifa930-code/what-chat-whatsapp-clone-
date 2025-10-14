# what-chat-whatsapp-clone-
Real-time messaging application for businesses built with React, Node.js, and Evolution API
# WhatChat - Enterprise WhatsApp Business Communication Platform

> A production-ready, real-time messaging platform built with React and Node.js, featuring native WhatsApp integration through Evolution API for secure business communications.

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-Private-red)](LICENSE)

## Overview

WhatChat is an enterprise-grade business communication platform that provides a complete WhatsApp messaging interface for internal business operations. Built as a private business tool, it offers real-time messaging capabilities with a professional, scalable architecture designed for secure organizational communications.

**Note:** This application is designed for private business use and is not publicly deployed. It operates within secure business environments with controlled access and user authentication.

---

## Key Features

### Core Functionality
- **Real-Time Messaging** - Instant message delivery and updates via Server-Sent Events (SSE) and webhook integration
- **WhatsApp Web Integration** - Native WhatsApp connectivity through Evolution API with QR code authentication
- **Multi-User Support** - User registration, authentication, and individual WhatsApp instance management
- **Rich Media Support** - Send and receive images, videos, voice messages, and documents
- **Voice Recording** - Built-in voice message recording with real-time audio capture
- **Emoji Picker** - Full emoji support with integrated emoji picker component

### Business Features
- **User Authentication** - Secure JWT-based authentication system with protected routes
- **Instance Management** - Each user maintains their own WhatsApp connection instance
- **Message History** - Complete chat history with message persistence
- **Connection Status** - Real-time connection monitoring and status indicators
- **Webhook Integration** - Automated message sync via Evolution API webhooks
- **CORS Security** - Configurable CORS policies for secure API communication

### Technical Highlights
- **Responsive Design** - Mobile-first UI that works seamlessly across devices
- **QR Code Authentication** - Secure WhatsApp Web authentication flow
- **RESTful API** - Well-structured backend API with organized route handlers
- **Environment Configuration** - Flexible configuration for different deployment environments
- **Error Handling** - Comprehensive error handling and logging throughout the stack

---

## Tech Stack

### Frontend
- **React 18.3.1** - Modern component-based UI framework
- **Vite 6.0** - Lightning-fast build tool and dev server
- **Axios** - Promise-based HTTP client for API communication
- **react-qr-code** - QR code generation for WhatsApp authentication
- **emoji-picker-react** - Full-featured emoji picker component

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Fast, minimalist web framework
- **Evolution API** - WhatsApp Web API integration
- **CORS** - Cross-Origin Resource Sharing middleware
- **dotenv** - Environment variable management

### Architecture Patterns
- Component-based architecture with React hooks
- RESTful API design with Express routers
- JWT authentication and authorization
- Real-time updates via SSE and webhooks
- Stateful connection management

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │    Auth    │  │  Chat UI   │  │  QR Code Auth   │   │
│  │  (Login/   │  │ (Messages, │  │  (WhatsApp Web  │   │
│  │  Signup)   │  │  Media)    │  │  Connection)    │   │
│  └────────────┘  └────────────┘  └─────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Express.js Backend                      │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │ Auth       │  │ Evolution  │  │   Webhook       │   │
│  │ Routes     │  │ API Routes │  │   Handler       │   │
│  └────────────┘  └────────────┘  └─────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               Evolution API (WhatsApp)                   │
│         Real-time WhatsApp Web Integration               │
└─────────────────────────────────────────────────────────┘
```

### How It Works

1. **User Authentication**: Users register/login through the secure authentication system with JWT tokens
2. **WhatsApp Connection**: Authenticated users scan a QR code to connect their WhatsApp account via Evolution API
3. **Instance Creation**: Each user gets a unique WhatsApp instance managed by the Evolution API
4. **Real-Time Sync**: Webhooks and SSE ensure messages are synchronized in real-time
5. **Message Flow**: Messages flow bidirectionally between the React frontend and WhatsApp via the Express backend

---

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Evolution API instance (self-hosted or managed)

### Backend Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd whatchat-new
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Create a `.env` file in the `backend` directory:
```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Evolution API Configuration
EVOLUTION_API_URL=your_evolution_api_url
EVOLUTION_API_KEY=your_api_key
```

4. Start the backend server:
```bash
node server.js
```

The backend will run on `http://localhost:4000`

### Frontend Setup

1. Install frontend dependencies (from root directory):
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
VITE_BACKEND_URL=http://localhost:4000
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

### Production Build

To create a production build:
```bash
npm run build
```

The optimized files will be in the `dist` directory.

---

## Project Structure

```
whatchat-new/
├── backend/
│   ├── routes/
│   │   ├── auth.js          # Authentication routes
│   │   ├── evolution.js     # Evolution API integration
│   │   └── webhook.js       # Webhook handlers
│   └── server.js            # Express server configuration
├── src/
│   ├── components/
│   │   ├── Login.jsx        # Login component
│   │   ├── Signup.jsx       # Registration component
│   │   ├── QRCode.jsx       # QR code authentication
│   │   ├── ChatList.jsx     # Chat list sidebar
│   │   ├── ChatWindow.jsx   # Main chat interface
│   │   ├── MessageInput.jsx # Message composition
│   │   ├── ImageMessage.jsx # Image message rendering
│   │   ├── VideoMessage.jsx # Video message rendering
│   │   ├── VoiceRecorder.jsx # Voice recording component
│   │   └── CallMessage.jsx  # Call notification messages
│   ├── services/
│   │   ├── evolutionApi.js  # Evolution API client
│   │   └── realtimeSync.js  # Real-time sync service
│   ├── context/
│   │   └── EvolutionContext.jsx # Global state management
│   ├── App.jsx              # Main application component
│   └── main.jsx             # Application entry point
├── package.json
└── vite.config.js           # Vite configuration
```

---

## What I Learned

Building this enterprise communication platform taught me invaluable lessons about full-stack development:

### Technical Skills
- **Real-Time Architecture** - Implementing SSE and webhooks for instant message delivery
- **WhatsApp Integration** - Working with Evolution API and understanding WhatsApp Web protocol
- **JWT Authentication** - Building secure authentication flows with token-based authorization
- **State Management** - Managing complex application state with React hooks and context
- **Media Handling** - Processing and displaying different media types (images, videos, audio)
- **API Design** - Creating scalable, RESTful API endpoints with proper error handling

### Best Practices
- **Component Architecture** - Building reusable, maintainable React components
- **Security** - Implementing CORS, authentication, and secure API communication
- **Error Handling** - Comprehensive error handling on both frontend and backend
- **Environment Configuration** - Managing different environments with environment variables
- **Code Organization** - Structuring a full-stack application for scalability

### Problem Solving
- Implementing real-time updates without performance degradation
- Managing WebSocket connections and reconnection logic
- Handling various message types and media formats
- Debugging webhook integration and asynchronous operations
- Optimizing chat list rendering for large contact lists

---

## Future Enhancements

Potential features for future iterations:

- [ ] End-to-end encryption for messages stored in the database
- [ ] Group chat management and administration
- [ ] Advanced search and filtering capabilities
- [ ] Message reactions and replies
- [ ] File upload with drag-and-drop
- [ ] User presence indicators (online/offline/typing)
- [ ] Message read receipts and delivery status
- [ ] Chat backup and export functionality
- [ ] Multi-language support (i18n)
- [ ] Dark mode theme
- [ ] Desktop notifications via Web Notifications API
- [ ] Voice/Video calling integration
- [ ] Admin dashboard for user management
- [ ] Analytics and usage metrics

---

## Deployment Note

This application is designed as a **private business tool** for internal organizational use. It is not deployed to public hosting platforms for the following reasons:

- **Business Security**: Contains sensitive business communication data requiring controlled access
- **Compliance Requirements**: Operates within private network infrastructure to meet organizational security policies
- **Resource Optimization**: Designed for specific business use cases rather than general public access
- **API Management**: Evolution API instances are managed privately for security and cost optimization

The application is production-ready and runs successfully in controlled business environments with proper authentication, security measures, and monitoring in place.

---

## License

This project is proprietary and confidential. All rights reserved.

---

## Contact

For business inquiries or technical questions, please contact: [Your Email/LinkedIn]

---

**Built with dedication to creating professional, scalable business communication solutions.**
