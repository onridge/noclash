import "dotenv/config";
import { db } from "./client";
import { seed } from "./seed";

async function main() {
  const { resource, bookingCount } = await seed(db);
  console.log(
    `Seeded "${resource.name}" (${resource.slug}) with ${bookingCount} bookings.`,
  );
  await db.$client.end();
}

main();
