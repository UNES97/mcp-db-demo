#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeDatabase, executeQuery, closeDatabase } from './database.js';
import { QUERIES } from './queries.js';

// Define interfaces for type safety
interface VesselVisit {
  name: string;
  visitId: string;
  phase: string;
  ata: Date | null;
  eta: Date;
  etd: Date;
  week_number: number;
  month: number;
  year: number;
  totalExecutedMoves: number;
  totalPlannedMoves: number;
}

interface VesselDetails {
  service: string;
  visitId: string;
  name: string;
  phase: string;
  allfast: Date | null;
  firstlift: Date | null;
  firstLine: Date | null;
  atd: Date | null;
  eta: Date;
  etd: Date;
  PORTHOURS: number;
  ESTIMATEDMOVES: number;
  portstayExecuted: number | null;
  idleArrival: number | null;
  idleDeparture: number | null;
}

interface VesselProductivity {
  visitId: string;
  vesselName: string;
  totalMoves: number;
  workingHours: number;
  cmph: number;
}

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'get_vessel_visits',
    description:
      'Get all vessel visits with their status, planned and executed moves. Returns up to 100 most recent visits, including inbound, arrived, working, complete, departed, and closed vessels.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_inbound_vessels_current_year',
    description:
      'Get all inbound vessels for the current year with details including ETA, ETD, port hours, and estimated moves.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_vessel_details',
    description:
      'Get detailed information about a specific vessel visit including service, phase, times (allfast, first lift, first line, ATD), port hours, estimated moves, and idle times.',
    inputSchema: {
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
  {
    name: 'get_visits_today',
    description:
      'Get all vessel visits scheduled for today at the terminal. Useful for answering questions like "what visits are at Tangier terminal today?"',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_vessel_productivity',
    description:
      'Get vessel productivity metrics including CMPH (Container Moves Per Hour) for a specific vessel. Returns total moves, working hours, and CMPH calculation.',
    inputSchema: {
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
];

// Create MCP server
const server = new Server(
  {
    name: 'apm-terminal-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_vessel_visits': {
        const results = await executeQuery<VesselVisit>(QUERIES.VESSEL_VISITS);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_inbound_vessels_current_year': {
        const results = await executeQuery(QUERIES.INBOUND_VESSELS_CURRENT_YEAR);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_vessel_details': {
        if (!args || typeof args !== 'object' || !('visitId' in args)) {
          throw new Error('visitId is required');
        }
        const { visitId } = args as { visitId: string };
        const results = await executeQuery<VesselDetails>(
          QUERIES.VESSEL_DETAILS_BY_ID,
          [visitId]
        );

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No vessel found with visit ID: ${visitId}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results[0], null, 2),
            },
          ],
        };
      }

      case 'get_visits_today': {
        const results = await executeQuery(QUERIES.VISITS_BY_TERMINAL);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_vessel_productivity': {
        if (!args || typeof args !== 'object' || !('vesselName' in args)) {
          throw new Error('vesselName is required');
        }
        const { vesselName } = args as { vesselName: string };
        const results = await executeQuery<VesselProductivity>(
          QUERIES.VESSEL_PRODUCTIVITY,
          [`%${vesselName}%`]
        );

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No productivity data found for vessel: ${vesselName}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Main function to start the server
async function main() {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.error('APM Terminal MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down...');
  await closeDatabase();
  process.exit(0);
});

// Start the server
main();
