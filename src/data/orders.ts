import { faker } from "@faker-js/faker";

export type FakeOrderItem = {
  product_id: string;
  quantity: number;
  unit_price_cents: number;
};

export type FakeOrder = {
  id: string;
  user_id: string;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  items: FakeOrderItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: "USD";
  shipping_address: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  created_at: string;
  updated_at: string;
};

export function generateOrder(seed: number): FakeOrder {
  faker.seed(seed + 20_000);

  const itemCount = faker.number.int({ min: 1, max: 4 });
  const items: FakeOrderItem[] = Array.from({ length: itemCount }, () => {
    const unitPriceDollars = faker.number.float({
      min: 9,
      max: 199,
      fractionDigits: 2,
    });
    return {
      product_id: `prd_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`,
      quantity: faker.number.int({ min: 1, max: 5 }),
      unit_price_cents: Math.round(unitPriceDollars * 100),
    };
  });

  const subtotal = items.reduce(
    (sum, it) => sum + it.unit_price_cents * it.quantity,
    0,
  );
  const tax = Math.round(subtotal * 0.0825);
  const createdAt = faker.date.past({ years: 1 });

  return {
    id: `ord_${faker.string.alphanumeric({ length: 14, casing: "lower" })}`,
    user_id: `usr_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`,
    status: faker.helpers.arrayElement([
      "pending",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
    ]),
    items,
    subtotal_cents: subtotal,
    tax_cents: tax,
    total_cents: subtotal + tax,
    currency: "USD",
    shipping_address: {
      line1: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postal_code: faker.location.zipCode(),
      country: "US",
    },
    created_at: createdAt.toISOString(),
    updated_at: faker.date
      .between({ from: createdAt, to: new Date() })
      .toISOString(),
  };
}

export function generateOrders(count: number, seedStart = 1): FakeOrder[] {
  return Array.from({ length: count }, (_, i) => generateOrder(seedStart + i));
}
