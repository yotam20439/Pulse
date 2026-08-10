import { neon } from "@neondatabase/serverless";
import { compare } from "bcryptjs";

const EMAIL = "dana@agency.test";
const PASSWORD = "pulse2026";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql(`SELECT id, email, is_active, password_hash FROM users WHERE email = '${EMAIL}'`);

  console.log("rows found:", rows.length);
  if (rows.length === 0) {
    const all = await sql(`SELECT email FROM users`);
    console.log("emails in database:", all.map((r: any) => r.email));
    return;
  }

  const user = rows[0] as any;
  console.log("is_active:", user.is_active);
  console.log("hash present:", Boolean(user.password_hash), "length:", user.password_hash?.length);
  console.log("hash prefix:", user.password_hash?.slice(0, 7));
  console.log("password matches:", await compare(PASSWORD, user.password_hash ?? ""));
}

main().catch(console.error);
