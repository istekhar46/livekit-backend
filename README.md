# LiveKit Voice Server

A backend service for managing SIP trunks, outbound calls, and LiveKit voice integrations.

## Overview

This project is a Node.js/Express backend that provides APIs for:
- Managing SIP outbound trunks
- Making outbound calls with recording capabilities
- Authentication
- Agent creation
- Listing call recordings

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn
- Environment variables (see Configuration section)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/livekitbackend.git
   cd livekitbackend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory (see Configuration section)

## Configuration

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
# LiveKit configuration
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=your_livekit_url

S3_BUCKET=bucket-name
S3_REGION=region
S3_ACCESS_KEY=access-key
S3_SECRET_KEY=secret-ky

PORT=3000
```

## Running the Server

### Development mode:
```bash
npm run dev
```

### Production mode:
```bash
npm run server
```

The server will start on the configured port (default: 3000).

## API Endpoints

### SIP Trunk Management
- `GET /api/trunks` - List all SIP outbound trunks
- `POST /api/trunks` - Create a new SIP outbound trunk
- `GET /api/deleteTrunk/:id` - Delete a SIP trunk by ID

### Call Management
- `POST /api/call` - Make an outbound call with recording
- `GET /api/recordings/:roomName` - List all recordings for a specific room

### Authentication
- `POST /getToken` - Get authentication token

### Agent Management
- `POST /create-agent` - Create a new agent

## Error Handling

The application includes global error handling middleware that will catch unhandled errors and return appropriate responses.

## Project Structure

```
├── backend/
│   ├── controller/
│   │   ├── authControllers.js
│   │   ├── outboundControllers.js
│   │   └── testAgentControllers.js
│   ├── router/
│   │   ├── authRouter.js
│   │   ├── outbountRouter.js
│   │   └── testAgentRouter.js
│   └── server.js
├── .env
├── package.json
└── README.md
```

## Dependencies

- express: Web framework
- livekit-server-sdk: LiveKit integration
- dotenv: Environment variable management
- cors: Cross-Origin Resource Sharing
- @modelcontextprotocol/sdk: Model Context Protocol SDK

## License

ISC

## Author

Istekhar