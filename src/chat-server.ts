import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, executeQuery } from './database.js';
import { QUERIES } from './queries.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.CHAT_SERVER_PORT || '3000');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize OpenAI client (works for both OpenAI and DeepSeek)
const aiProvider = process.env.AI_PROVIDER || 'DEEPSEEK';
const openai = new OpenAI({
  apiKey: aiProvider === 'OPENAI'
    ? process.env.OPENAI_API_KEY
    : process.env.DEEPSEEK_API_KEY,
  baseURL: aiProvider === 'DEEPSEEK'
    ? 'https://api.deepseek.com'
    : 'https://api.openai.com/v1',
});

// Define tools for function calling (matching your MCP tools)
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_vessel_visits',
      description: 'Get all vessel visits with their status, planned and executed moves. Returns up to 100 most recent visits, including inbound, arrived, working, complete, departed, and closed vessels.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inbound_vessels_current_year',
      description: 'Get all inbound vessels for the current year with details including ETA, ETD, port hours, and estimated moves.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vessel_details',
      description: 'Get detailed information about a specific vessel visit including service, phase, times (allfast, first lift, first line, ATD), port hours, estimated moves, and idle times.',
      parameters: {
        type: 'object',
        properties: {
          visitId: {
            type: 'string',
            description: 'The visit ID of the vessel (e.g., "TNG001")',
          },
        },
        required: ['visitId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_visits_today',
      description: 'Get all vessel visits scheduled for today at the terminal. Useful for answering questions like "what visits are at Tangier terminal today?"',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vessel_productivity',
      description: 'Get vessel productivity metrics including CMPH (Container Moves Per Hour) for a specific vessel. Returns total moves, working hours, and CMPH calculation.',
      parameters: {
        type: 'object',
        properties: {
          vesselName: {
            type: 'string',
            description: 'The name of the vessel (partial match supported, e.g., "MAERSK")',
          },
        },
        required: ['vesselName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vessel_cranes',
      description: 'Get all cranes that worked on a specific vessel visit with their first and last move times. Shows crane allocation and timing.',
      parameters: {
        type: 'object',
        properties: {
          visitId: {
            type: 'string',
            description: 'The visit ID of the vessel (e.g., "TNG001")',
          },
        },
        required: ['visitId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vessel_longest_crane',
      description: 'Get the crane with the longest estimated move time for vessels currently in WORKING phase. Useful for identifying the critical path crane.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inbound_vessels_date_range',
      description: 'Get all inbound vessels within a specific date range. Returns vessel details with ETA, ETD, port hours, and estimated moves.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format',
          },
          endDate: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format',
          },
        },
        required: ['startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_crane_delays',
      description: 'Get historical crane delay information including delay codes, descriptions, and durations. Can be filtered by vessel visit ID.',
      parameters: {
        type: 'object',
        properties: {
          visitId: {
            type: 'string',
            description: 'Optional vessel visit ID to filter delays. If not provided, returns all delays.',
          },
        },
      },
    },
  },
];

// Execute database tool functions
async function executeToolFunction(name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case 'get_vessel_visits':
        return await executeQuery(QUERIES.VESSEL_VISITS);

      case 'get_inbound_vessels_current_year':
        return await executeQuery(QUERIES.INBOUND_VESSELS_CURRENT_YEAR);

      case 'get_vessel_details':
        const detailsResults = await executeQuery(QUERIES.VESSEL_DETAILS_BY_ID, [args.visitId]);
        return detailsResults.length > 0 ? detailsResults[0] : { error: `No vessel found with visit ID: ${args.visitId}` };

      case 'get_visits_today':
        return await executeQuery(QUERIES.VISITS_BY_TERMINAL);

      case 'get_vessel_productivity':
        return await executeQuery(QUERIES.VESSEL_PRODUCTIVITY, [`%${args.vesselName}%`]);

      case 'get_vessel_cranes':
        return await executeQuery(QUERIES.VESSEL_CRANES, [args.visitId]);

      case 'get_vessel_longest_crane':
        return await executeQuery(QUERIES.VESSEL_LONGEST_CRANE);

      case 'get_inbound_vessels_date_range':
        return await executeQuery(QUERIES.INBOUND_VESSELS_DATE_RANGE, [args.startDate, args.endDate]);

      case 'get_crane_delays':
        // If visitId is provided, use it; otherwise pass null for both parameters
        const visitId = args.visitId || null;
        return await executeQuery(QUERIES.CRANE_DELAYS_HISTORICAL, [visitId, visitId]);

      default:
        return { error: `Unknown function: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    return { error: String(error) };
  }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Add system message if not present
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant for APM Terminal operations. You help users query vessel visit data, productivity metrics, and terminal operations.

When users ask questions, use the available functions to retrieve accurate data from the database. Format your responses in a clear, professional manner.

For numerical data, include relevant context and units (e.g., CMPH, hours, container counts).`,
    };

    const allMessages = messages[0]?.role === 'system'
      ? messages
      : [systemMessage, ...messages];

    // Call OpenAI/DeepSeek API
    let response = await openai.chat.completions.create({
      model: aiProvider === 'OPENAI' ? 'gpt-4o' : 'deepseek-chat',
      messages: allMessages,
      tools: tools,
      tool_choice: 'auto',
    });

    let responseMessage = response.choices[0].message;

    // Handle function calls
    const toolCalls = responseMessage.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      // Add assistant's message with tool calls to conversation
      allMessages.push(responseMessage);

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`Executing function: ${functionName} with args:`, functionArgs);

        const functionResult = await executeToolFunction(functionName, functionArgs);

        // Add function result to conversation
        allMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(functionResult),
        });
      }

      // Get final response from the model
      const secondResponse = await openai.chat.completions.create({
        model: aiProvider === 'OPENAI' ? 'gpt-4o' : 'deepseek-chat',
        messages: allMessages,
      });

      responseMessage = secondResponse.choices[0].message;
    }

    res.json({
      message: responseMessage.content,
      usage: response.usage,
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    res.status(500).json({
      error: error.message || 'An error occurred processing your request'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: aiProvider,
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✓ Database connected');

    // Check API key
    const apiKey = aiProvider === 'OPENAI'
      ? process.env.OPENAI_API_KEY
      : process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error(`${aiProvider}_API_KEY is not set in .env file`);
    }
    console.log(`✓ ${aiProvider} API key configured`);

    // Start Express server
    app.listen(port, '0.0.0.0', () => {
      console.log(`\n🚀 APM Terminal Chat Server running!`);
      console.log(`   URL: http://0.0.0.0:${port}`);
      console.log(`   AI Provider: ${aiProvider}`);
      console.log(`\n   Server is accessible from outside the container!\n`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
