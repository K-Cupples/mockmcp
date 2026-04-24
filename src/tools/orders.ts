import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateOrder, generateOrders } from "../data/orders.js";

export function registerOrderTools(server: McpServer) {
  server.registerTool(
    "list_orders",
    {
      description:
        "List mock orders with optional pagination and status filter.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(10)
          .describe("How many orders to return. Max 100."),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Starting offset for pagination."),
        status: z
          .enum(["pending", "paid", "shipped", "delivered", "cancelled"])
          .optional()
          .describe("Filter by order status."),
      },
    },
    async ({ limit, offset, status }) => {
      let orders = generateOrders(limit, offset + 1);
      if (status) orders = orders.filter((o) => o.status === status);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { data: orders, total: 2500, limit, offset, filter: { status } },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_order",
    {
      description: "Fetch a single mock order by ID or numeric seed.",
      inputSchema: {
        id: z
          .union([z.string(), z.number()])
          .describe("Order ID (e.g. 'ord_abc123') or numeric seed."),
      },
    },
    async ({ id }) => {
      const seed =
        typeof id === "number"
          ? id
          : Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const order = generateOrder(seed);
      if (typeof id === "string") order.id = id;
      return {
        content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_order",
    {
      description:
        "Create a mock order. Not persisted — returns a freshly generated order echoing your items.",
      inputSchema: {
        user_id: z.string().describe("User ID placing the order."),
        items: z
          .array(
            z.object({
              product_id: z.string(),
              quantity: z.number().int().min(1),
              unit_price_cents: z.number().int().min(0),
            }),
          )
          .min(1)
          .describe("Line items."),
      },
    },
    async ({ user_id, items }) => {
      const base = generateOrder(Date.now() % 100_000);
      const subtotal = items.reduce(
        (sum, it) => sum + it.unit_price_cents * it.quantity,
        0,
      );
      const tax = Math.round(subtotal * 0.0825);
      const order = {
        ...base,
        user_id,
        status: "pending" as const,
        items,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: subtotal + tax,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
      };
    },
  );
}
