import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateProduct, generateProducts } from "../data/products.js";

export function registerProductTools(server: McpServer) {
  server.registerTool(
    "list_products",
    {
      description:
        "List mock products with optional pagination. Deterministic fake data.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(10)
          .describe("How many products to return. Max 100."),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Starting offset for pagination."),
      },
    },
    async ({ limit, offset }) => {
      const products = generateProducts(limit, offset + 1);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { data: products, total: 1000, limit, offset },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_product",
    {
      description: "Fetch a single mock product by ID or numeric seed.",
      inputSchema: {
        id: z
          .union([z.string(), z.number()])
          .describe("Product ID (e.g. 'prd_abc123') or numeric seed."),
      },
    },
    async ({ id }) => {
      const seed =
        typeof id === "number"
          ? id
          : Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const product = generateProduct(seed);
      if (typeof id === "string") product.id = id;
      return {
        content: [{ type: "text", text: JSON.stringify(product, null, 2) }],
      };
    },
  );
}
