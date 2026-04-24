import { faker } from "@faker-js/faker";

export type FakeProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
  price_cents: number;
  currency: "USD";
  image_url: string;
  category: string;
  stock: number;
  created_at: string;
};

export function generateProduct(seed: number): FakeProduct {
  faker.seed(seed + 10_000);
  const priceDollars = faker.number.float({
    min: 5,
    max: 499,
    fractionDigits: 2,
  });
  return {
    id: `prd_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`,
    sku: faker.string.alphanumeric({ length: 8, casing: "upper" }),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price_cents: Math.round(priceDollars * 100),
    currency: "USD",
    image_url: faker.image.urlPicsumPhotos({ width: 640, height: 480 }),
    category: faker.commerce.department(),
    stock: faker.number.int({ min: 0, max: 500 }),
    created_at: faker.date.past({ years: 2 }).toISOString(),
  };
}

export function generateProducts(count: number, seedStart = 1): FakeProduct[] {
  return Array.from({ length: count }, (_, i) =>
    generateProduct(seedStart + i),
  );
}
