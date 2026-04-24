import { faker } from "@faker-js/faker";

export type FakeEvent = {
  id: string;
  user_id: string;
  event_type: string;
  properties: Record<string, string | number | boolean>;
  timestamp: string;
};

const EVENT_TYPES = [
  "page_viewed",
  "signup_completed",
  "subscription_started",
  "checkout_abandoned",
  "feature_enabled",
  "button_clicked",
  "video_watched",
  "file_uploaded",
  "invite_sent",
  "comment_posted",
];

export function generateEvent(seed: number): FakeEvent {
  faker.seed(seed + 30_000);
  const type = faker.helpers.arrayElement(EVENT_TYPES);
  return {
    id: `evt_${faker.string.alphanumeric({ length: 14, casing: "lower" })}`,
    user_id: `usr_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`,
    event_type: type,
    properties: buildProperties(type),
    timestamp: faker.date.recent({ days: 30 }).toISOString(),
  };
}

export function generateEvents(count: number, seedStart = 1): FakeEvent[] {
  return Array.from({ length: count }, (_, i) => generateEvent(seedStart + i));
}

function buildProperties(
  type: string,
): Record<string, string | number | boolean> {
  switch (type) {
    case "page_viewed":
      return {
        path: faker.helpers.arrayElement([
          "/dashboard",
          "/pricing",
          "/settings",
          "/blog/post-42",
          "/docs/intro",
        ]),
        referrer: faker.internet.url(),
      };
    case "signup_completed":
      return { plan: faker.helpers.arrayElement(["free", "pro", "team"]) };
    case "subscription_started":
      return {
        plan: faker.helpers.arrayElement(["pro", "team", "enterprise"]),
        amount_cents: faker.number.int({ min: 1900, max: 49900 }),
        interval: faker.helpers.arrayElement(["month", "year"]),
      };
    case "checkout_abandoned":
      return {
        cart_value_cents: faker.number.int({ min: 500, max: 30000 }),
        step: faker.helpers.arrayElement(["email", "payment", "review"]),
      };
    case "button_clicked":
      return { label: faker.lorem.words(2), location: "header" };
    default:
      return { source: faker.helpers.arrayElement(["web", "ios", "android"]) };
  }
}
