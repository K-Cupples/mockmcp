import { faker } from "@faker-js/faker";

export type FakeKbArticle = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  score: number;
  updated_at: string;
};

const CATEGORIES = [
  "Getting started",
  "Billing",
  "API reference",
  "Integrations",
  "Troubleshooting",
  "Account",
  "Security",
];

// Seeded article. Score is a fake relevance score between 0 and 1.
export function generateKbArticle(seed: number, query?: string): FakeKbArticle {
  faker.seed(seed + 40_000);
  const title = query
    ? `How to ${query} in our platform`
    : faker.company.catchPhrase();
  return {
    id: `kb_${faker.string.alphanumeric({ length: 10, casing: "lower" })}`,
    title,
    excerpt: faker.lorem.sentences(2),
    body: faker.lorem.paragraphs(3, "\n\n"),
    category: faker.helpers.arrayElement(CATEGORIES),
    tags: faker.helpers.arrayElements(
      ["setup", "api", "webhooks", "auth", "errors", "limits", "export"],
      { min: 1, max: 3 },
    ),
    score: Number(
      faker.number.float({ min: 0.45, max: 0.99, fractionDigits: 2 }),
    ),
    updated_at: faker.date.past({ years: 1 }).toISOString(),
  };
}

export function generateKbResults(
  count: number,
  query: string,
  seedStart = 1,
): FakeKbArticle[] {
  const results = Array.from({ length: count }, (_, i) =>
    generateKbArticle(seedStart + i, query),
  );
  // Sort descending by score so "search results" feel real.
  return results.sort((a, b) => b.score - a.score);
}
