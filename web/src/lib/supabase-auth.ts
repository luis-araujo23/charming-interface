import type { SupabaseClient, User } from "@supabase/supabase-js";

// Bridge helper for the mobile (hybrid) flow: makes sure a Supabase Auth user
// exists, is confirmed, has the given password, and is linked to its row in
// public.users (auth_id) so the phone app obtains a session that satisfies
// RLS / SECURITY DEFINER RPCs. The web app itself authenticates only against
// the public.users table; this is exposed to mobile via /api/auth/sync.
export async function ensureSupabaseAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string,
  username?: string,
) {
  const normalizedEmail = email.trim().toLowerCase();

  // The `auth` schema is not exposed to PostgREST, so it cannot be queried with
  // `.from("auth.users")`. We create the user pre-confirmed (email_confirm) so
  // that email confirmation is effectively disabled for the mobile flow.
  const { data: createData, error: authCreateError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    user_metadata: username ? { username } : undefined,
    email_confirm: true,
  });

  let authUserId = createData?.user?.id ?? null;

  if (authCreateError) {
    const message = authCreateError.message?.toLowerCase() ?? "";
    const alreadyExists =
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("duplicate") ||
      message.includes("exists");

    if (!alreadyExists) {
      throw authCreateError;
    }

    // The Auth user already exists (possibly created unconfirmed by an older
    // flow). Confirm it and re-sync the password so signInWithPassword works.
    const existing = await findAuthUserByEmail(supabase, normalizedEmail);
    if (existing) {
      authUserId = existing.id;
      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });

      if (updateError) {
        throw updateError;
      }
    }
  }

  // Link the public.users row to the Auth user. This runs with the service role
  // so it bypasses RLS (the phone client cannot set auth_id itself because the
  // RLS policy is keyed on auth_id). Without this link, RLS hides the user's
  // own rows and the app fails with "0 rows".
  if (authUserId) {
    // SECURITY: make sure this Auth user is not still linked to a DIFFERENT
    // profile. A stale/mislinked auth_id lets one account resolve to another
    // user (via `WHERE auth_id = auth.uid()`) and read their private notes.
    const { error: unlinkError } = await supabase
      .from("users")
      .update({ auth_id: null })
      .eq("auth_id", authUserId)
      .neq("email", normalizedEmail);

    if (unlinkError) {
      throw unlinkError;
    }

    const { error: linkError } = await supabase
      .from("users")
      .update({ auth_id: authUserId })
      .eq("email", normalizedEmail);

    if (linkError) {
      throw linkError;
    }
  }
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<User | null> {
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) {
      return found;
    }

    if (data.users.length < perPage) {
      break;
    }
  }

  return null;
}
