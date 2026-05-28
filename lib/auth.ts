import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser } from "./services/supabase";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session }) {
      return session;
    },
    async signIn({ user }) {
      if (user.email && user.name) {
        try {
          await upsertUser({
            email: user.email,
            name: user.name.replace(/\b\w/g, c => c.toUpperCase()),
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Failed to upsert user on sign-in:", e);
        }
      }
      return true;
    },
  },
});

const ADMIN_EMAILS = new Set(
  [
    "alexanderpintaric@gmail.com",          // hardcoded owner
    ...(process.env.ADMIN_EMAIL ?? "").split(",").map(e => e.trim()).filter(Boolean),
  ]
);

export function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email);
}
