import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

if (!process.env.ADMIN_EMAIL) {
  console.error("ADMIN_EMAIL environment variable is required.");
  process.exit(1);
}
const email: string = process.env.ADMIN_EMAIL;

async function main() {
  const [updated] = await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.email, email))
    .returning();

  if (!updated) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }

  console.log(`User "${updated.firstName} ${updated.lastName}" (${updated.email}) set to role=admin.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-admin failed:", err);
  process.exit(1);
});
