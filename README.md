# APM Terminal - Operations Intelligence Platform

AI-powered operations assistant for APM Terminal with vessel tracking, crane management, and productivity analytics.

![APM Terminal](https://img.shields.io/badge/APM-Terminals-003C71)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)
![MySQL](https://img.shields.io/badge/MySQL-5.7-4479A1?logo=mysql)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)

## Overview

This project provides both a **web-based chat interface** and a **Model Context Protocol (MCP) server** for querying APM Terminal database operations. Interact with vessel visit data, crane statistics, productivity metrics, and terminal operations through natural language queries.

## Features

### Web Chat Interface
- **AI-Powered Queries**: Natural language questions answered by OpenAI/DeepSeek
- **Professional UI**: Clean, corporate interface with APM/MAERSK branding
- **Real-time Data**: Live operational data from MySQL database
- **Quick Queries**: Predefined query buttons for common questions

### Available Queries
- **Vessel Operations**: Track visits, phases, schedules, and details
- **Productivity Metrics**: Calculate CMPH (Container Moves Per Hour)
- **Crane Management**: Monitor assignments, delays, and performance
- **Date Range Analysis**: Query vessels within specific time periods

### MCP Server Tools
The MCP server provides the following programmatic tools:

1. **get_vessel_visits** - Get all vessel visits with status, planned and executed moves
2. **get_inbound_vessels_current_year** - Get all inbound vessels for the current year
3. **get_vessel_details** - Get detailed information about a specific vessel visit
4. **get_visits_today** - Get all vessel visits scheduled for today
5. **get_vessel_productivity** - Get CMPH (Container Moves Per Hour) metrics for a vessel
6. **get_vessel_cranes** - Get crane assignments with first/last move times
7. **get_vessel_longest_crane** - Identify longest working crane for active vessels
8. **get_inbound_vessels_date_range** - Query vessels within date range
9. **get_crane_delays** - Historical crane delay information

## Quick Start

### Option 1: Docker (Recommended for Deployment)

```bash
# 1. Clone and navigate
cd /path/to/MCP

# 2. Configure environment
cp .env.example .env
# Edit .env and set OPENAI_API_KEY

# 3. Start with Docker
make install
# Or: docker-compose up -d

# 4. Access application
open http://localhost:3000
```

See [DOCKER.md](DOCKER.md) for detailed Docker documentation.

### Option 2: Local Development (MAMP/XAMPP)

```bash
# 1. Install dependencies
npm install

# 2. Import database
mysql -u root -p < demo_database.sql

# 3. Configure environment
cp .env.example .env
# Edit .env with your local MySQL credentials

# 4. Build and run
npm run build
npm run chat:prod

# 5. Access application
open http://localhost:3000
```

## Docker Commands

Using the included Makefile for common tasks:

```bash
make help          # Show all available commands
make up            # Start all services
make down          # Stop all services
make logs          # View logs (follow mode)
make logs-app      # View application logs only
make logs-mysql    # View MySQL logs only
make shell         # Access application shell
make mysql-shell   # Access MySQL CLI
make backup        # Backup database
make health        # Check service health
make rebuild       # Rebuild and restart
make clean-all     # Remove everything including data (WARNING)
```

## Example Queries

### Vessel Tracking
- "What visits are at the terminal today?"
- "Show me all inbound vessels this year"
- "Show vessel details for TNG001"
- "Which vessels are currently operational?"
- "Show inbound vessels from 2025-01-01 to 2025-01-31"

### Productivity Analysis
- "What is the CMPH of MSC vessels?"
- "What is the productivity of Maersk Line vessels?"

### Crane Management
- "Show me cranes assigned to visit TNG001"
- "Which crane worked the longest on working vessels?"
- "Show me crane delays"

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Edit `.env` with your MySQL database credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=apm_terminal
DB_CONNECTION_LIMIT=10
```

4. Build the TypeScript code:
```bash
npm run build
```

## Usage

### Running in Development Mode

```bash
npm run dev
```

### Running in Production Mode

```bash
npm start
```

### Configuring with Claude Desktop

Add this to your Claude Desktop configuration file:

**On macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**On Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "apm-terminal": {
      "command": "node",
      "args": ["/Applications/MAMP/htdocs/MCP/build/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_USER": "your_database_user",
        "DB_PASSWORD": "your_database_password",
        "DB_NAME": "apm_terminal"
      }
    }
  }
}
```

Or use the path to the package:

```json
{
  "mcpServers": {
    "apm-terminal": {
      "command": "/Applications/MAMP/htdocs/MCP/build/index.js"
    }
  }
}
```

Make sure your `.env` file is properly configured when using the second approach.

## Database Schema

The server expects the following tables to be present in your MySQL database:

### Core Tables
- `argo_carrier_visit` - Vessel visit records
- `argo_visit_details` - Visit details including ETA/ETD
- `vsl_vessel_visit_details` - Vessel-specific visit details
- `vsl_vessels` - Vessel information
- `ref_carrier_service` - Carrier service information
- `ref_bizunit_scoped` - Business unit/operator information
- `inv_move_event` - Container move events with crane assignments
- `inv_wi` - Work instructions with estimated move times

### Crane & Equipment Tables
- `xps_che` - Crane equipment (quay cranes)
- `xps_pointofwork` - Berth positions and work points
- `xps_craneshift` - Crane shift schedules
- `inv_wq` - Work queues linking cranes to vessels
- `vsl_crane_statistics` - Crane performance statistics
- `vsl_crane_statistics_delays` - Delay records for cranes
- `ref_crane_delay_types` - Delay type classifications

The complete schema with sample data is available in `demo_database.sql`.

## Tools Reference

### get_vessel_visits
Returns up to 100 most recent vessel visits with:
- Vessel name
- Visit ID
- Phase (INBOUND, ARRIVED, WORKING, COMPLETE, DEPARTED, CLOSED)
- Arrival/departure times
- Week, month, year
- Total executed moves
- Total planned moves

### get_inbound_vessels_current_year
Returns inbound vessels for current year with:
- Visit ID
- Vessel name
- Phase
- Service and line
- ETA/ETD
- Port hours
- Estimated moves

### get_vessel_details
Requires: `visitId` parameter

Returns detailed vessel information:
- Service
- Phase
- All key timestamps (allfast, first lift, first line, ATD)
- Port hours (planned and executed)
- Estimated moves
- Idle times (arrival and departure)

### get_visits_today
Returns all visits scheduled for today with:
- Vessel name
- Visit ID
- Phase
- ETA/ETD times

### get_vessel_productivity
Requires: `vesselName` parameter (supports partial matching)

Returns productivity metrics:
- Visit ID
- Vessel name
- Total moves (discharge + load)
- Working hours
- CMPH (Container Moves Per Hour)

## Development

### Project Structure

```
/Applications/MAMP/htdocs/MCP/
├── src/
│   ├── index.ts       # Main MCP server implementation
│   ├── database.ts    # Database connection and query utilities
│   └── queries.ts     # SQL queries adapted for MySQL
├── build/             # Compiled JavaScript (generated)
├── .env               # Environment variables (create from .env.example)
├── .env.example       # Example environment variables
├── package.json       # Node.js dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

### Adding New Queries

1. Add your SQL query to `src/queries.ts`
2. Create a new tool definition in `src/index.ts`
3. Add a case handler in the CallToolRequestSchema handler
4. Rebuild with `npm run build`

## Troubleshooting

### Database Connection Issues
- Verify your `.env` file has correct credentials
- Ensure MySQL server is running
- Check that the database name is correct
- Verify network connectivity to the database host

### MCP Server Not Appearing in Claude Desktop
- Check that the path in `claude_desktop_config.json` is correct
- Ensure the build was successful (`npm run build`)
- Restart Claude Desktop after configuration changes
- Check Claude Desktop logs for error messages

### Query Errors
- Verify that all required database tables exist
- Check that table schemas match the expected structure
- Ensure the database user has appropriate permissions

## License

MIT
