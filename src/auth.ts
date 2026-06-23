import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowedEmail } from "@/lib/auth-helpers";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    error: "/sign-in",
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth }) {
      return isAllowedEmail(auth?.user?.email);
    },
    signIn({ profile, user }) {
      const email =
        typeof profile?.email === "string" ? profile.email : user.email;

      return isAllowedEmail(email);
    },
  },
});
