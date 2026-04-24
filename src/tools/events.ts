import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateEvent, generateEvents } from "../data/events.js";

export function registerEventTools(server: McpServer) {
  server.registerTool(
    "list_events",
    {
      description:
        "List mock analytics events, optionally filtered by user or event type.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        user_id: z.string().optional().describe("Filter by user ID."),
        event_type: z.string().optional().describe("Filter by event type."),
      },
    },
    async ({ limit, offset, user_id, event_type }) => {
      let events = generateEvents(limit, offset + 1);
      if (user_id) events = events.map((e) => ({ ...e, user_id }));
      if (event_type)
        events = events.map((e) => ({ ...e, event_type: event_type }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                data: events,
                total: 25000,
                limit,
                offset,
                filter: { user_id, event_type },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "create_event",
    {
      description:
        "Record a mock analytics event. Not persisted — echoes your input with a generated id and timestamp.",
      inputSchema: {
        user_id: z.string(),
        event_type: z.string().min(1),
        properties: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ user_id, event_type, properties }) => {
      const base = generateEvent(Date.now() % 100_000);
      const event = {
        ...base,
        user_id,
        event_type,
        properties: properties ?? base.properties,
        timestamp: new Date().toISOString(),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(event, null, 2) }],
      };
    },
  );
}
