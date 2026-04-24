import { faker } from "@faker-js/faker";

export type FakeUser = {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  created_at: string;
  role: "admin" | "member" | "viewer";
};

// Deterministic generator — same seed → same data across requests.
// Gives callers predictable fixtures without persisting anything.
export function generateUser(seed: number): FakeUser {
  faker.seed(seed);
  return {
    id: `usr_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`,
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    avatar_url: faker.image.avatarGitHub(),
    created_at: faker.date.past({ years: 2 }).toISOString(),
    role: faker.helpers.arrayElement(["admin", "member", "viewer"]),
  };
}

export function generateUsers(count: number, seedStart = 1): FakeUser[] {
  return Array.from({ length: count }, (_, i) => generateUser(seedStart + i));
}
