import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateKbResults } from "../data/knowledge.js";

export function registerKnowledgeBaseTools(server: McpServer) {
  server.registerTool(
    "search_knowledge_base",
    {
      description:
        "Search a mock knowledge base. Returns fake articles ranked by a pseudo-relevance score.",
      inputSchema: {
        query: z.string().min(1).describe("Search query."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .default(5)
          .describe("How many articles to return. Max 25."),
      },
    },
    async ({ query, limit }) => {
      const results = generateKbResults(limit, query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ query, results }, null, 2),
          },
        ],
      };
    },
  );
}
