import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUserTools } from "./tools/users.js";
import { registerProductTools } from "./tools/products.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerEventTools } from "./tools/events.js";
import { registerEmailTools } from "./tools/email.js";
import { registerKnowledgeBaseTools } from "./tools/knowledge.js";

// Build a fresh MCP server instance. We create a new one per session so
// each connection has isolated state.
export function buildMcpServer() {
  const server = new McpServer(
    {
      name: "mockmcp",
      version: "0.1.0",
    },
    {
      instructions:
        "MockMCP returns realistic fake data for prototyping agents. " +
        "Nothing is persisted. Identical inputs return identical outputs.",
    },
  );

  registerUserTools(server);
  registerProductTools(server);
  registerOrderTools(server);
  registerEventTools(server);
  registerEmailTools(server);
  registerKnowledgeBaseTools(server);

  return server;
}
