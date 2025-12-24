# APM Terminal Chat Interface Setup Guide

This guide will help you set up the web-based chat interface that uses DeepSeek or OpenAI API to interact with your APM Terminal database.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
│   Browser   │ ←──→ │ Express      │ ←──→ │ DeepSeek/    │      │  MySQL   │
│   (Chat UI) │      │ Chat Server  │      │ OpenAI API   │      │ Database │
└─────────────┘      └──────────────┘      └──────────────┘      └──────────┘
                              │
                              └─────────────────────────────────→ (direct queries)
```

## Prerequisites

1. Node.js 18+ installed
2. MySQL database with demo data loaded
3. DeepSeek API key or OpenAI API key

## Step 1: Get Your API Key

### Option A: DeepSeek (Recommended - More Affordable)

1. Visit [https://platform.deepseek.com](https://platform.deepseek.com)
2. Sign up for an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (you'll need it in Step 3)

### Option B: OpenAI

1. Visit [https://platform.openai.com](https://platform.openai.com)
2. Sign up/login
3. Go to API Keys section
4. Create a new secret key
5. Copy the key

## Step 2: Install Dependencies

```bash
cd /Applications/MAMP/htdocs/MCP
npm install
```

This will install:
- `express` - Web server
- `cors` - Cross-origin support
- `openai` - API client (works with both OpenAI and DeepSeek)
- And other required packages

## Step 3: Configure Environment Variables

1. If you haven't already, copy the example env file:
```bash
cp .env.example .env
```

2. Edit `.env` file and add your configuration:

```env
# MySQL Database (already configured)
DB_HOST=localhost
DB_PORT=8889
DB_USER=root
DB_PASSWORD=root
DB_NAME=apm_terminal
DB_CONNECTION_LIMIT=10

# AI Configuration
AI_PROVIDER=DEEPSEEK
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# OR if using OpenAI:
# AI_PROVIDER=OPENAI
# OPENAI_API_KEY=your_openai_api_key_here

# Chat Server Port
CHAT_SERVER_PORT=3000
```

## Step 4: Build the TypeScript Code

```bash
npm run build
```

## Step 5: Start the Chat Server

### Development Mode (with auto-reload):
```bash
npm run chat
```

### Production Mode:
```bash
npm run chat:prod
```

You should see:
```
✓ Database connected
✓ DEEPSEEK API key configured

🚀 APM Terminal Chat Server running!
   URL: http://localhost:3000
   AI Provider: DEEPSEEK

   Open http://localhost:3000 in your browser to start chatting!
```

## Step 6: Open the Chat Interface

1. Open your browser
2. Navigate to: `http://localhost:3000`
3. You should see the APM Terminal Assistant interface
4. Start chatting!

## Example Queries

Try asking:

- "What visits are at the terminal today?"
- "Show me all inbound vessels this year"
- "What is the CMPH of MSC vessels?"
- "Get details for vessel visit TNG001"
- "What are the current vessel visits and their status?"

## How It Works

1. **User asks a question** in the web interface
2. **Frontend** sends the message to Express server at `/api/chat`
3. **Backend** sends the question to DeepSeek/OpenAI with function definitions
4. **AI decides** which database function to call based on the question
5. **Backend executes** the SQL query against MySQL database
6. **AI formats** the raw data into a natural language response
7. **User sees** a formatted, easy-to-understand answer

## Troubleshooting

### "API key not configured"
- Make sure you've set `DEEPSEEK_API_KEY` or `OPENAI_API_KEY` in your `.env` file
- Restart the server after changing `.env`

### "Database connection failed"
- Ensure MySQL is running (check MAMP)
- Verify database credentials in `.env`
- Make sure demo data is loaded (`demo_database.sql`)

### "Port 3000 already in use"
- Change `CHAT_SERVER_PORT` in `.env` to another port (e.g., 3001)
- Restart the server

### Chat interface shows "Disconnected"
- Check if the server is running
- Look for errors in the terminal where you started the server
- Check browser console (F12) for errors

## API Costs

### DeepSeek
- Very affordable: ~$0.14 per million input tokens
- ~$0.28 per million output tokens
- Suitable for production use

### OpenAI
- GPT-4: ~$2.50 per million input tokens
- More expensive but potentially higher quality responses

For typical queries, expect:
- ~500-1000 tokens per conversation turn
- Cost per query: $0.0001 - $0.001 (DeepSeek)
- Cost per query: $0.001 - $0.01 (OpenAI GPT-4)

## Switching Between Providers

To switch from DeepSeek to OpenAI or vice versa:

1. Edit `.env`:
```env
# For DeepSeek
AI_PROVIDER=DEEPSEEK
DEEPSEEK_API_KEY=your_key

# For OpenAI
AI_PROVIDER=OPENAI
OPENAI_API_KEY=your_key
```

2. Restart the server

## Production Deployment

For production deployment:

1. Use environment variables instead of `.env` file
2. Set up HTTPS with a reverse proxy (nginx/Apache)
3. Use PM2 or similar for process management
4. Monitor API usage and costs
5. Implement rate limiting
6. Add authentication if needed

## Next Steps

- Customize the UI in `public/` directory
- Add more tools/queries in `src/queries.ts`
- Implement user authentication
- Add conversation history persistence
- Create analytics dashboard

## Support

For issues or questions:
- Check server logs in terminal
- Check browser console (F12)
- Verify API key is valid
- Ensure database is accessible
