import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, executeQuery } from './database.js';
import { initializeDatabaseSchema } from './init-database.js';
import { QUERIES } from './queries.js';
import * as chatHistory from './chat-history.js';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Cache Layer ───────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number): void {
    // Evict oldest if full
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  get size(): number { return this.store.size; }

  clear(): void { this.store.clear(); }
}

// TTLs in ms (configurable via env, values in minutes)
const TTL = {
  STATIC:   (parseInt(process.env.CACHE_TTL_STATIC   || '30')) * 60 * 1000,
  SLOW:     (parseInt(process.env.CACHE_TTL_SLOW     || '10')) * 60 * 1000,
  LIVE:     (parseInt(process.env.CACHE_TTL_LIVE     || '30')) * 60 * 1000,
  RESPONSE: (parseInt(process.env.CACHE_TTL_RESPONSE || '30')) * 60 * 1000,
};

// Which tools get which TTL
const TOOL_TTL: Record<string, number> = {
  get_equipment_list:              TTL.STATIC,
  get_yard_inventory_by_category:  TTL.SLOW,
  get_yard_inventory_by_block:     TTL.SLOW,
  get_dwell_time_by_category:      TTL.SLOW,
  get_shift_handover:               TTL.LIVE,
  get_vessel_ranking:               TTL.LIVE,
  get_delay_breakdown:              TTL.LIVE,
  get_delay_by_vessel:              TTL.LIVE,
  get_monthly_cmph:                 TTL.LIVE,
  get_gate_hourly_pattern:          TTL.LIVE,
  get_berth_utilization:            TTL.LIVE,
  get_compare_weekly_moves:         TTL.LIVE,
  get_compare_weekly_productivity:  TTL.LIVE,
  get_compare_weekly_delays:        TTL.LIVE,
  get_terminal_overview:            TTL.LIVE,
  get_vessel_visits:               TTL.LIVE,
  get_visits_today:                TTL.LIVE,
  get_visits_by_date:              TTL.LIVE,
  get_inbound_vessels_current_year:TTL.LIVE,
  get_inbound_vessels_date_range:  TTL.LIVE,
  get_vessel_details:              TTL.LIVE,
  get_vessel_productivity:         TTL.LIVE,
  get_vessel_cranes:               TTL.LIVE,
  get_vessel_longest_crane:        TTL.LIVE,
  get_crane_delays:                TTL.LIVE,
  get_crane_delays_summary:        TTL.LIVE,
  get_crane_delays_by_crane:       TTL.LIVE,
  get_gate_activity:               TTL.LIVE,
  get_gate_truck_turnaround:       TTL.LIVE,
  get_equipment_daily_moves:       TTL.LIVE,
  get_crane_moves_by_vessel:       TTL.LIVE,
  get_vessel_twin_stats:           TTL.LIVE,
};

const queryCache = new TTLCache<any>();       // Layer 1: DB query results
const responseCache = new TTLCache<any>();     // Layer 2: full Claude responses

// Response time + error tracking
const responseTimes: number[] = [];
const recentErrors: { time: string; message: string }[] = [];
function recordResponseTime(ms: number) {
  responseTimes.push(ms);
  if (responseTimes.length > 100) responseTimes.shift();
}
function recordError(msg: string) {
  recentErrors.push({ time: new Date().toISOString(), message: msg });
  if (recentErrors.length > 20) recentErrors.shift();
}

// Normalize message to a cache key (lowercase, collapse whitespace, trim)
function normalizeForCache(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Build cache key for a tool call
function toolCacheKey(name: string, args: any): string {
  return `${name}:${JSON.stringify(args || {})}`;
}

// ─── End Cache Layer ───────────────────────────────────────────────────────────

const app = express();
const port = parseInt(process.env.CHAT_SERVER_PORT || '3000');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define tools for function calling
const tools: Anthropic.Tool[] = [
  {
    name: 'get_vessel_visits',
    description: 'Get all vessel visits with their status, planned and executed moves. Returns up to 100 most recent visits, including inbound, arrived, working, complete, departed, and closed vessels.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_inbound_vessels_current_year',
    description: 'Get all inbound vessels for the current year with details including ETA, ETD, port hours, and estimated moves.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_vessel_details',
    description: 'Get detailed information about a specific vessel visit including service, phase, times (allfast, first lift, first line, ATD), port hours, estimated moves, and idle times.',
    input_schema: {
      type: 'object' as const,
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
    description: 'Get all vessel visits scheduled for today at the terminal. Useful for answering questions like "what visits are at the terminal today?"',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_visits_by_date',
    description: 'Get all vessel visits scheduled for a specific date at the terminal. Accepts dates in YYYY-MM-DD format.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'The date in YYYY-MM-DD format (e.g., "2026-01-26")',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_vessel_productivity',
    description: 'Get vessel productivity metrics including CMPH (Container Moves Per Hour) for a specific vessel. Returns total moves, working hours, and CMPH calculation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vesselName: {
          type: 'string',
          description: 'The name of the vessel (partial match supported, e.g., "MAERSK")',
        },
      },
      required: ['vesselName'],
    },
  },
  {
    name: 'get_vessel_cranes',
    description: 'Get all cranes that worked on a specific vessel visit with their first and last move times. Shows crane allocation and timing.',
    input_schema: {
      type: 'object' as const,
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
    name: 'get_vessel_longest_crane',
    description: 'Get the crane with the longest estimated move time for vessels currently in WORKING phase. Useful for identifying the critical path crane.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_inbound_vessels_date_range',
    description: 'Get all inbound vessels within a specific date range. Returns vessel details with ETA, ETD, port hours, and estimated moves.',
    input_schema: {
      type: 'object' as const,
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
  {
    name: 'get_crane_delays',
    description: 'Get historical crane delay records with timestamps, durations, delay codes, categories, and vessel names. Can be filtered by vessel visit ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        visitId: {
          type: 'string',
          description: 'Optional vessel visit ID to filter delays. If not provided, returns all delays.',
        },
      },
    },
  },
  {
    name: 'get_crane_delays_summary',
    description: 'Get crane delay summary grouped by delay category and type. Shows occurrence count, total minutes, and average duration per delay type. Great for charts.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_crane_delays_by_crane',
    description: 'Get crane delay totals per crane. Shows which cranes have the most delays, total delay minutes, and average delay duration.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_shift_handover',
    description: 'Get shift handover data for the last 8 hours. Returns vessel activity, total moves, delays, and gate stats for the shift. Use when asked for shift handover, shift report, or last 8 hours summary.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_vessel_ranking',
    description: 'Get all vessels ranked by CMPH (productivity) this month. Returns best and worst performers with moves, hours, and CMPH. Use for "best/worst vessels", "top performers", "vessel ranking".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_delay_breakdown',
    description: 'Get delay breakdown by category with percentage of total. Shows equipment vs weather vs vessel vs terminal delays. Use for "delay breakdown", "delay percentages", "what causes delays".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_delay_by_vessel',
    description: 'Get top vessels with most delays this month, showing delay count, total minutes, and which categories affected them. Use for "delay root causes", "which vessels had most delays".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_monthly_cmph',
    description: 'Get average, min, and max CMPH for the current month across all vessels. Use for "monthly productivity", "CMPH vs target", "average CMPH".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_gate_hourly_pattern',
    description: 'Get gate throughput by hour of day (last 7 days average). Shows transactions, receives, deliveries, and turnaround per hour. Use for "gate throughput", "peak hours", "gate capacity".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_berth_utilization',
    description: 'Get daily vessel count at terminal for the last 30 days. Shows vessels per day, working count, and completed count. Use for "berth utilization", "how many vessels per day".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_compare_weekly_moves',
    description: 'Compare this week vs last week total moves (discharge and load). Returns both periods in one result. Use this for weekly move comparisons.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_compare_weekly_productivity',
    description: 'Compare this week vs last week vessel productivity (CMPH) per vessel. Returns both periods with moves, hours, and CMPH. Use this for weekly productivity comparisons.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_compare_weekly_delays',
    description: 'Compare this week vs last week crane delays by category. Returns both periods with occurrence count and total minutes. Use this for weekly delay comparisons.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_terminal_overview',
    description: 'Get a comprehensive terminal overview for today. Returns ALL key data in one call: vessel visits with moves, hourly move distribution, yard inventory summary, gate activity, crane delays by category, and crane productivity (CMPH). Use this when asked for a terminal overview, daily report, or dashboard summary.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_yard_inventory_by_category',
    description: 'Get current yard inventory breakdown by category (IMPORT/EXPORT/TRANSSHIP) and reefer/dry. Shows units and TEUs in yard.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_yard_inventory_by_block',
    description: 'Get current yard inventory by yard block. Shows units, TEUs, reefer count, and hazardous count per block and category.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_gate_activity',
    description: 'Get gate truck transaction summary (receive/delivery counts, reefer, hazardous) for a specific date. Defaults to today.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today if not provided.',
        },
      },
    },
  },
  {
    name: 'get_gate_truck_turnaround',
    description: 'Get individual truck turnaround times (time in, time out, duration in minutes) for a specific date. Defaults to today.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today if not provided.',
        },
      },
    },
  },
  {
    name: 'get_equipment_list',
    description: 'Get list of all active terminal equipment (cranes, RTGs, reach stackers, etc.) with their types.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_equipment_daily_moves',
    description: 'Get daily move counts for a specific equipment type (QC, RTG, RS, FLT) within a date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        equipmentType: {
          type: 'string',
          description: 'Equipment type: "QC" (quay crane), "RTG" (rubber-tired gantry), "RST" (reach stacker), "FLT" (forklift/empty handler)',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
      },
      required: ['equipmentType', 'startDate', 'endDate'],
    },
  },
  {
    name: 'get_dwell_time_by_category',
    description: 'Get average and maximum dwell time (in days) for containers currently in the yard, grouped by category and reefer/dry.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_crane_moves_by_vessel',
    description: 'Get detailed crane move breakdown (discharge vs load, 20ft vs 40ft) for a specific vessel visit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        visitId: {
          type: 'string',
          description: 'The vessel visit ID',
        },
      },
      required: ['visitId'],
    },
  },
  {
    name: 'get_vessel_twin_stats',
    description: 'Get twin lift statistics for a vessel visit. Shows total moves, twin moves count, and twin percentage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        visitId: {
          type: 'string',
          description: 'The vessel visit ID',
        },
      },
      required: ['visitId'],
    },
  },
];

// Execute database tool functions (with Layer 1 cache)
async function executeToolFunction(name: string, args: any): Promise<any> {
  const cacheKey = toolCacheKey(name, args);
  const cached = queryCache.get(cacheKey);
  if (cached) {
    console.log(`  ⚡ Cache hit: ${name}`);
    return cached;
  }

  const result = await executeToolFunctionRaw(name, args);
  const ttl = TOOL_TTL[name] || TTL.LIVE;
  queryCache.set(cacheKey, result, ttl);
  return result;
}

async function executeToolFunctionRaw(name: string, args: any): Promise<any> {
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

      case 'get_visits_by_date':
        return await executeQuery(QUERIES.VISITS_BY_TERMINAL_DATE, [args.date]);

      case 'get_vessel_productivity':
        return await executeQuery(QUERIES.VESSEL_PRODUCTIVITY, [`%${args.vesselName}%`]);

      case 'get_vessel_cranes':
        return await executeQuery(QUERIES.VESSEL_CRANES, [args.visitId, args.visitId]);

      case 'get_vessel_longest_crane':
        return await executeQuery(QUERIES.VESSEL_LONGEST_CRANE);

      case 'get_inbound_vessels_date_range':
        return await executeQuery(QUERIES.INBOUND_VESSELS_DATE_RANGE, [args.startDate, args.endDate]);

      case 'get_crane_delays':
        const visitId = args.visitId || null;
        return await executeQuery(QUERIES.CRANE_DELAYS_HISTORICAL, [visitId, visitId]);

      case 'get_crane_delays_summary':
        return await executeQuery(QUERIES.CRANE_DELAYS_SUMMARY);

      case 'get_crane_delays_by_crane':
        return await executeQuery(QUERIES.CRANE_DELAYS_BY_CRANE);

      case 'get_shift_handover':
        const [shVessels, shMoves, shDelays, shGate] = await Promise.all([
          executeQuery(QUERIES.SHIFT_HANDOVER),
          executeQuery(QUERIES.SHIFT_MOVES),
          executeQuery(QUERIES.SHIFT_DELAYS),
          executeQuery(QUERIES.SHIFT_GATE),
        ]);
        return {
          vessels: shVessels[0] || {},
          moves: shMoves[0] || {},
          delays: shDelays,
          gate: shGate[0] || {},
        };

      case 'get_vessel_ranking':
        return await executeQuery(QUERIES.HQ_VESSEL_RANKING);

      case 'get_delay_breakdown':
        return await executeQuery(QUERIES.HQ_DELAY_BREAKDOWN);

      case 'get_delay_by_vessel':
        return await executeQuery(QUERIES.HQ_DELAY_BY_VESSEL);

      case 'get_monthly_cmph':
        return await executeQuery(QUERIES.HQ_MONTHLY_CMPH);

      case 'get_gate_hourly_pattern':
        return await executeQuery(QUERIES.HQ_GATE_HOURLY);

      case 'get_berth_utilization':
        return await executeQuery(QUERIES.HQ_BERTH_UTILIZATION);

      case 'get_compare_weekly_moves':
        return await executeQuery(QUERIES.COMPARE_WEEKLY_MOVES);

      case 'get_compare_weekly_productivity':
        return await executeQuery(QUERIES.COMPARE_WEEKLY_PRODUCTIVITY);

      case 'get_compare_weekly_delays':
        return await executeQuery(QUERIES.COMPARE_WEEKLY_DELAYS);

      case 'get_terminal_overview':
        const [ovVessels, ovMoves, ovYard, ovGate, ovDelays, ovCranes] = await Promise.all([
          executeQuery(QUERIES.OVERVIEW_VESSELS_TODAY),
          executeQuery(QUERIES.OVERVIEW_MOVES_BY_HOUR),
          executeQuery(QUERIES.OVERVIEW_YARD_SUMMARY),
          executeQuery(QUERIES.OVERVIEW_GATE_SUMMARY),
          executeQuery(QUERIES.OVERVIEW_DELAYS_TODAY),
          executeQuery(QUERIES.OVERVIEW_CRANE_PRODUCTIVITY),
        ]);
        return {
          vessels_at_terminal: ovVessels,
          moves_by_hour: ovMoves,
          yard_summary: ovYard,
          gate_summary: ovGate[0] || {},
          delays_by_category: ovDelays,
          crane_productivity: ovCranes,
        };

      case 'get_yard_inventory_by_category':
        return await executeQuery(QUERIES.YARD_INVENTORY_BY_CATEGORY);

      case 'get_yard_inventory_by_block':
        return await executeQuery(QUERIES.YARD_INVENTORY_BY_BLOCK);

      case 'get_gate_activity':
        const gateDate = args.date || null;
        return await executeQuery(QUERIES.GATE_ACTIVITY, [gateDate, gateDate]);

      case 'get_gate_truck_turnaround':
        const ttDate = args.date || null;
        return await executeQuery(QUERIES.GATE_TRUCK_TURNAROUND, [ttDate]);

      case 'get_equipment_list':
        return await executeQuery(QUERIES.EQUIPMENT_LIST);

      case 'get_equipment_daily_moves':
        return await executeQuery(QUERIES.EQUIPMENT_DAILY_MOVES, [args.equipmentType, args.startDate, args.endDate]);

      case 'get_dwell_time_by_category':
        return await executeQuery(QUERIES.DWELL_TIME_BY_CATEGORY);

      case 'get_crane_moves_by_vessel':
        return await executeQuery(QUERIES.CRANE_MOVES_BY_VESSEL, [args.visitId, args.visitId]);

      case 'get_vessel_twin_stats':
        return await executeQuery(QUERIES.VESSEL_TWIN_STATS, [args.visitId]);

      case 'get_kpi_active_vessels':
        return await executeQuery(QUERIES.KPI_ACTIVE_VESSELS);

      case 'get_kpi_moves_today':
        return await executeQuery(QUERIES.KPI_TOTAL_MOVES_TODAY);

      case 'get_kpi_yard_teus':
        return await executeQuery(QUERIES.KPI_YARD_TEUS);

      case 'get_kpi_avg_turnaround':
        return await executeQuery(QUERIES.KPI_AVG_TURNAROUND);

      default:
        return { error: `Unknown function: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    return { error: String(error) };
  }
}

// System prompt for Claude
const SYSTEM_PROMPT = `APMT Terminal AI. Today: ${new Date().toISOString().slice(0, 10)}.

RULES: Be direct. Use tools for data. Tables + charts for results.

INSIGHTS: After presenting data (tables/charts), ALWAYS add a "Key Insights" section with 2-4 bullet points analyzing the data:
- Identify trends, anomalies, or notable patterns
- Compare values to benchmarks or averages (e.g. "CMPH of 18.2 is below the 25 target")
- Flag risks or concerns (e.g. "3 containers have dwell time exceeding 7 days")
- Suggest actionable next steps when relevant
Format as: **Key Insights** followed by bullet points. Be specific — reference actual values, vessel names, percentages from the data.

IMPORTANT — TOOL SELECTION:
- For weekly comparisons: use get_compare_weekly_* tools (one call, both periods)
- For vessel rankings/best/worst: use get_vessel_ranking (one call, all data)
- For delay analysis: use get_delay_breakdown or get_delay_by_vessel (one call each)
- For monthly CMPH: use get_monthly_cmph (one call)
- For gate patterns: use get_gate_hourly_pattern (one call)
- For berth stats: use get_berth_utilization (one call)
- For terminal overview: use get_terminal_overview (one call, all sections)
- NEVER call multiple tools when a dedicated combined tool exists
- Call tools in PARALLEL when possible (multiple tool_use blocks in one response)

DATES: Resolve "last week", "this month", etc. to YYYY-MM-DD before calling tools.

CHARTS: Include when data has 3+ comparable items:
\`\`\`chart
{"type":"bar","title":"Title","labels":["A","B"],"datasets":[{"label":"Series","data":[1,2]}]}
\`\`\`
Types: bar, line, pie, doughnut, horizontalBar. Keep labels under 15 chars.

COMPARISONS: Use side-by-side table (Metric | Period 1 | Period 2 | Change %) + grouped bar chart.

SHIFT HANDOVER: When asked for shift handover/report, use get_shift_handover. Format as:
- Shift period (last 8 hours with timestamps)
- Vessels: arrived, departed, currently working
- Moves: discharge, load, total
- Delays: by category with minutes
- Gate: transactions, turnaround
- Key issues and pending items
- Recommendations for next shift

EXECUTIVE SUMMARY: When asked for executive summary/card/shareable, present a compact card:
- Terminal name + date
- 4 headline numbers (vessels, moves, CMPH, yard %)
- Top performer + biggest concern (one line each)
- Trend arrow (up/down vs last week)
Keep it under 10 lines — designed to be screenshot-friendly.

FOLLOW-UPS: End every response with:
\`\`\`followups
["Specific question 1","Specific question 2","Specific question 3"]
\`\`\`
Reference actual data from your response. Keep under 60 chars each.`;

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { messages, conversationId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Layer 2: Check response cache (only for single-turn — last user message)
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const responseCacheKey = lastUserMsg ? normalizeForCache(lastUserMsg.content) : null;

    if (responseCacheKey) {
      const cachedResponse = responseCache.get(responseCacheKey);
      if (cachedResponse) {
        console.log(`⚡ Response cache hit: "${responseCacheKey.slice(0, 50)}..."`);
        return res.json(cachedResponse);
      }
    }

    // Convert messages to Anthropic format (filter out system messages)
    const claudeMessages: Anthropic.MessageParam[] = messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Call Claude API
    let response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
      tools: tools,
    });

    // Handle tool use in a loop (Claude may call multiple tools)
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Add assistant response to messages
      claudeMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        console.log(`Executing function: ${toolUse.name} with args:`, toolUse.input);

        const functionResult = await executeToolFunction(toolUse.name, toolUse.input);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(functionResult),
        });
      }

      // Add tool results to messages
      claudeMessages.push({
        role: 'user',
        content: toolResults,
      });

      // Get next response
      response = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
        tools: tools,
      });
    }

    // Extract text from response
    let textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Parse follow-up suggestions
    let followups: string[] = [];
    const followupMatch = textContent.match(/```followups\s*\n([\s\S]*?)```/);
    if (followupMatch) {
      try {
        followups = JSON.parse(followupMatch[1].trim());
      } catch (e) { /* ignore malformed followups */ }
      textContent = textContent.replace(/```followups\s*\n[\s\S]*?```/, '').trim();
    }

    // Persist to conversation history
    if (conversationId && lastUserMsg) {
      try {
        await chatHistory.addMessage(conversationId, 'user', lastUserMsg.content);
        await chatHistory.addMessage(conversationId, 'assistant', textContent);
        // Auto-title from first user message
        const msgs = await chatHistory.getMessages(conversationId);
        if (msgs.length <= 2) {
          await chatHistory.updateTitle(conversationId, lastUserMsg.content.slice(0, 80));
        }
      } catch (e) { console.error('History save error:', e); }
    }

    const responsePayload = {
      message: textContent,
      followups,
      usage: response.usage,
      cached: false,
    };

    // Store in response cache
    if (responseCacheKey) {
      responseCache.set(responseCacheKey, { ...responsePayload, cached: true }, TTL.RESPONSE);
    }

    recordResponseTime(Date.now() - startTime);
    res.json(responsePayload);

  } catch (error: any) {
    recordError(error.message || 'Unknown error');
    console.error('Chat API error:', error);
    res.status(500).json({
      error: error.message || 'An error occurred processing your request'
    });
  }
});

// Streaming chat endpoint (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const streamStart = Date.now();
  const { messages, conversationId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // SSE setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (res.socket) {
    res.socket.setNoDelay(true);
    res.socket.setTimeout(0);
  }

  // Write SSE — pad small writes to exceed Node's internal buffer threshold
  const PADDING = ' '.repeat(256);
  const sendSSE = (type: string, data: any) => {
    if (aborted) return;
    const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
    res.write(payload + `:${PADDING}\n\n`);
  };

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');

    // Check response cache
    const responseCacheKey = lastUserMsg ? normalizeForCache(lastUserMsg.content) : null;
    if (responseCacheKey) {
      const cached = responseCache.get(responseCacheKey);
      if (cached) {
        sendSSE('text', { content: cached.message });
        sendSSE('done', { followups: cached.followups || [], usage: cached.usage, cached: true });
        return res.end();
      }
    }

    const claudeMessages: Anthropic.MessageParam[] = messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let fullText = '';
    let continueLoop = true;

    sendSSE('status', { message: 'connected' });

    while (continueLoop && !aborted) {
      console.log('  Starting stream...');
      const stream = anthropic.messages.stream({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
        tools: tools,
      });

      // Stream text deltas
      stream.on('text', (text) => {
        if (!aborted) {
          fullText += text;
          sendSSE('text', { content: text });
        }
      });

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason === 'tool_use') {
        const toolUseBlocks = finalMessage.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        // Notify frontend which tools are running
        const toolNames = toolUseBlocks.map(t => t.name);
        sendSSE('tool_status', { tools: toolNames });
        console.log(`  Tools: ${toolNames.join(', ')}`);

        claudeMessages.push({ role: 'assistant', content: finalMessage.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          if (aborted) break;
          const result = await executeToolFunction(toolUse.name, toolUse.input);
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
          // Keep connection alive during tool execution
          sendSSE('tool_progress', { tool: toolUse.name, status: 'done' });
        }

        claudeMessages.push({ role: 'user', content: toolResults });
        fullText = ''; // Reset — new stream will produce the full answer
        sendSSE('tool_done', { tools: toolUseBlocks.map(t => t.name) });
      } else {
        continueLoop = false;
      }
    }

    if (aborted) return;

    // Parse followups
    let followups: string[] = [];
    const followupMatch = fullText.match(/```followups\s*\n([\s\S]*?)```/);
    if (followupMatch) {
      try { followups = JSON.parse(followupMatch[1].trim()); } catch (e) {}
      fullText = fullText.replace(/```followups\s*\n[\s\S]*?```/, '').trim();
    }

    // Persist to history
    if (conversationId && lastUserMsg) {
      try {
        await chatHistory.addMessage(conversationId, 'user', lastUserMsg.content);
        await chatHistory.addMessage(conversationId, 'assistant', fullText);
        const msgs = await chatHistory.getMessages(conversationId);
        if (msgs.length <= 2) await chatHistory.updateTitle(conversationId, lastUserMsg.content.slice(0, 80));
      } catch (e) {}
    }

    // Cache the response
    if (responseCacheKey) {
      responseCache.set(responseCacheKey, { message: fullText, followups, usage: null, cached: true }, TTL.RESPONSE);
    }

    recordResponseTime(Date.now() - streamStart);
    sendSSE('done', { followups, usage: null, cached: false });
    res.end();

  } catch (error: any) {
    recordError(error.message || 'Stream error');
    if (!aborted) {
      sendSSE('error', { message: error.message || 'An error occurred' });
      res.end();
    }
  }
});

// Email report endpoint
app.post('/api/send-report', async (req, res) => {
  const { email, html, subject } = req.body;

  if (!email || !html) {
    return res.status(400).json({ error: 'Email and HTML content are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    return res.status(500).json({ error: 'SMTP not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to .env' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `APMT Reports <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject || `APMT Operations Report — ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;">
          <div style="border-bottom:3px solid #FF6B35;padding-bottom:12px;margin-bottom:20px;">
            <div style="font-size:18px;color:#003C71;">APMT Operations Report</div>
            <div style="font-size:12px;color:#666;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div style="font-size:13px;line-height:1.7;color:#1a1a1a;">${html}</div>
          <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;text-align:center;">
            Generated by APMT Operations Intelligence Platform
          </div>
        </div>
      `,
    });

    res.json({ status: 'sent' });
  } catch (error: any) {
    console.error('Email send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: 'Claude',
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    cache: {
      queryEntries: queryCache.size,
      responseEntries: responseCache.size,
    },
    timestamp: new Date().toISOString()
  });
});

// KPI endpoint
app.get('/api/kpis', async (req, res) => {
  try {
    const [vessels, moves, yard, turnaround] = await Promise.all([
      executeToolFunction('get_kpi_active_vessels', {}),
      executeToolFunction('get_kpi_moves_today', {}),
      executeToolFunction('get_kpi_yard_teus', {}),
      executeToolFunction('get_kpi_avg_turnaround', {}),
    ]);
    res.json({
      activeVessels: vessels[0]?.count || 0,
      totalMovesToday: moves[0]?.count || 0,
      yardTeus: yard[0]?.teus || 0,
      avgTurnaround: turnaround[0]?.avg_minutes || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Conversation history endpoints
app.post('/api/conversations', async (req, res) => {
  const id = await chatHistory.createConversation();
  res.json({ id });
});

app.get('/api/conversations', async (req, res) => {
  res.json(await chatHistory.getConversations());
});

app.get('/api/conversations/:id', async (req, res) => {
  const messages = await chatHistory.getMessages(req.params.id);
  res.json(messages);
});

app.delete('/api/conversations/:id', async (req, res) => {
  await chatHistory.deleteConversation(req.params.id);
  res.json({ status: 'deleted' });
});

// Feedback endpoint
app.post('/api/feedback', async (req, res) => {
  const { conversationId, messageId, rating } = req.body;
  if (!messageId || ![1, -1].includes(rating)) {
    return res.status(400).json({ error: 'messageId and rating (1 or -1) required' });
  }
  await chatHistory.saveFeedback(conversationId || 'anonymous', messageId, rating);
  res.json({ status: 'ok' });
});

// Annotations
app.post('/api/annotations', async (req, res) => {
  const { messageId, author, text } = req.body;
  if (!messageId || !text) return res.status(400).json({ error: 'messageId and text required' });
  await chatHistory.addAnnotation(messageId, author || 'User', text);
  const annotations = await chatHistory.getAnnotations(messageId);
  res.json(annotations);
});

app.get('/api/annotations/:messageId', async (req, res) => {
  const annotations = await chatHistory.getAnnotations(req.params.messageId);
  res.json(annotations);
});

app.delete('/api/annotations/:id', async (req, res) => {
  await chatHistory.deleteAnnotation(parseInt(req.params.id));
  res.json({ status: 'deleted' });
});

// Cache management
app.delete('/api/cache', (req, res) => {
  queryCache.clear();
  responseCache.clear();
  console.log('🗑️  Cache cleared');
  res.json({ status: 'cleared' });
});

// Admin dashboard
app.get('/admin', async (req, res) => {
  const stats = await chatHistory.getStats();
  const avgTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  const uptime = Math.round(process.uptime());
  const uptimeStr = `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`;

  res.send(`<!DOCTYPE html><html><head><title>APMT Admin</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @font-face { font-family:'Maersk Headline'; src:url('/fonts/maersk-fonts/Maersk Headline/Maersk Headline Webfonts/MaerskHeadline-Light.woff2') format('woff2'); font-weight:300; font-display:swap; }
  @font-face { font-family:'Maersk Headline'; src:url('/fonts/maersk-fonts/Maersk Headline/Maersk Headline Webfonts/MaerskHeadline-Regular.woff2') format('woff2'); font-weight:400; font-display:swap; }
  @font-face { font-family:'Maersk Headline'; src:url('/fonts/maersk-fonts/Maersk Headline/Maersk Headline Webfonts/MaerskHeadline-Bold.woff2') format('woff2'); font-weight:700; font-display:swap; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Maersk Headline',system-ui,sans-serif;background:#f9fafb;color:#1a1a1a;padding:24px;max-width:900px;margin:0 auto}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px}
  .card{background:#fff;border:1px solid #e5e7eb;padding:16px}
  .card .label{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px}
  .card .value{font-size:22px;color:#003C71;margin-top:4px}
  .card .sub{font-size:11px;color:#9ca3af;margin-top:2px}
  .card .positive{color:#10b981}
  .card .negative{color:#ef4444}
  h1{font-size:16px;color:#003C71;font-weight:400;margin-bottom:4px}
  h2{font-size:11px;color:#FF6B35;font-weight:400;text-transform:uppercase;letter-spacing:1.5px;margin:24px 0 8px}
  .tag{font-size:10px;color:#FF6B35;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e5e7eb}
  th{background:#003C71;color:#fff;padding:8px 12px;text-align:left;font-weight:400}
  td{padding:6px 12px;border-bottom:1px solid #f3f4f6}
  .empty{color:#9ca3af;font-size:12px;padding:12px}
  .icon{display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:4px}
</style></head><body>
<div class="tag">apmt</div>
<h1>System Dashboard</h1>

<h2>Overview</h2>
<div class="grid">
  <div class="card"><div class="label">Uptime</div><div class="value">${uptimeStr}</div></div>
  <div class="card"><div class="label">Avg Response</div><div class="value">${avgTime > 0 ? (avgTime/1000).toFixed(1) + 's' : 'N/A'}</div><div class="sub">${responseTimes.length} samples</div></div>
  <div class="card"><div class="label">Query Cache</div><div class="value">${queryCache.size}</div><div class="sub">entries</div></div>
  <div class="card"><div class="label">Response Cache</div><div class="value">${responseCache.size}</div><div class="sub">entries</div></div>
</div>

<h2>Conversations</h2>
<div class="grid">
  <div class="card"><div class="label">Total Conversations</div><div class="value">${stats.totalConversations}</div></div>
  <div class="card"><div class="label">Total Messages</div><div class="value">${stats.totalMessages}</div></div>
  <div class="card"><div class="label">Positive Feedback</div><div class="value positive"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>${stats.thumbsUp}</div></div>
  <div class="card"><div class="label">Negative Feedback</div><div class="value negative"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>${stats.thumbsDown}</div></div>
</div>

<h2>Recent Response Times</h2>
${responseTimes.length > 0 ? `<table><tr><th>#</th><th>Duration</th></tr>
${responseTimes.slice(-10).reverse().map((t, i) => `<tr><td>${i+1}</td><td>${(t/1000).toFixed(1)}s</td></tr>`).join('')}
</table>` : '<div class="empty">No responses recorded yet</div>'}

<h2>Recent Errors</h2>
${recentErrors.length > 0 ? `<table><tr><th>Time</th><th>Error</th></tr>
${recentErrors.slice(-10).reverse().map(e => `<tr><td>${e.time.slice(11,19)}</td><td>${e.message}</td></tr>`).join('')}
</table>` : '<div class="empty">No errors</div>'}

</body></html>`);
});

// Start server
async function startServer() {
  try {
    // Import database schema if needed
    await initializeDatabaseSchema();

    // Initialize database connection pool
    await initializeDatabase();
    console.log('✓ Database connected');

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in .env file');
    }
    console.log('✓ Anthropic API key configured');

    // Start Express server
    app.listen(port, '0.0.0.0', () => {
      console.log(`\n🚀 COMPASS Terminal Chat Server running!`);
      console.log(`   URL: http://0.0.0.0:${port}`);
      console.log(`   AI Provider: Claude (${process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'})`);
      console.log(`\n   Server is accessible from outside the container!\n`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
