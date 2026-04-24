import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateUser, generateUsers } from "../data/users.js";

// Register user-related tools on the MCP server.
// All tools return realistic fake data from a deterministic seed.
export function registerUserTools(server: McpServer) {
  server.registerTool(
    "list_users",
    {
      description:
        "List mock users with optional pagination. Returns a deterministic set of fake users useful for prototyping agents.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(10)
          .describe("How many users to return. Max 100."),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Starting offset for pagination."),
      },
    },
    async ({ limit, offset }) => {
      const users = generateUsers(limit, offset + 1);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { data: users, total: 500, limit, offset },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_user",
    {
      description: "Fetch a single mock user by ID or numeric seed.",
      inputSchema: {
        id: z
          .union([z.string(), z.number()])
          .describe(
            "User ID (e.g. 'usr_abc123') or numeric seed (e.g. 1). Numeric seed returns the same user as list_users would at that position.",
          ),
      },
    },
    async ({ id }) => {
      // If a string ID is passed, derive a deterministic seed from it so the
      // same ID always returns the same user.
      const seed =
        typeof id === "number"
          ? id
          : Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const user = generateUser(seed);
      // Echo back the requested ID when it was a string so callers see their input.
      if (typeof id === "string") user.id = id;
      return {
        content: [{ type: "text", text: JSON.stringify(user, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_user",
    {
      description:
        "Create a mock user. Data is not persisted — returns a fresh fake user echoing your inputs.",
      inputSchema: {
        email: z.string().email().describe("Email for the new user."),
        name: z.string().min(1).describe("Full name for the new user."),
        role: z
          .enum(["admin", "member", "viewer"])
          .default("member")
          .describe("User role."),
      },
    },
    async ({ email, name, role }) => {
      const base = generateUser(Date.now() % 100_000);
      const user = { ...base, email, name, role };
      return {
        content: [{ type: "text", text: JSON.stringify(user, null, 2) }],
      };
    },
  );
}
