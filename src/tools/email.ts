import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";

export function registerEmailTools(server: McpServer) {
  server.registerTool(
    "send_email",
    {
      description:
        "Send a mock email. Nothing is actually delivered — returns a success response with a generated message ID.",
      inputSchema: {
        to: z
          .union([z.string().email(), z.array(z.string().email())])
          .describe("Single recipient or array of recipients."),
        from: z.string().email().optional(),
        subject: z.string().min(1),
        body: z.string().min(1).describe("Plain text or HTML body."),
        cc: z.array(z.string().email()).optional(),
        bcc: z.array(z.string().email()).optional(),
      },
    },
    async ({ to, from, subject, body, cc, bcc }) => {
      const recipients = Array.isArray(to) ? to : [to];
      const response = {
        id: `msg_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        status: "queued" as const,
        to: recipients,
        from: from ?? "noreply@mockmcp.io",
        subject,
        preview: body.slice(0, 140),
        cc: cc ?? [],
        bcc: bcc ?? [],
        queued_at: new Date().toISOString(),
        note: "MockMCP does not deliver real email. This is a simulated success response.",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    },
  );
}
