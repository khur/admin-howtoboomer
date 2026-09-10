// Supabase Edge Function — privileged admin actions on other users' accounts.
//
// The admin portal calls this for anything that needs the service-role key.
// Today that is only `delete`. Reads and profile edits go straight through
// Postgres, gated by the `profiles.is_admin` RLS policies.
//
// Authorization: the caller's JWT is verified with getUser(), then their own
// `profiles.is_admin` row is checked with the service client. The service key
// never leaves this function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Same deletion order as `delete-account`: owned rows, then files, then the auth user. */
async function deleteUser(userId: string): Promise<void> {
  const { error: historyError } = await admin
    .from("user_activity_history")
    .delete()
    .eq("user_id", userId);
  if (historyError) throw historyError;

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("user_id", userId);
  if (profileError) throw profileError;

  try {
    const { data: files } = await admin.storage.from("avatars").list(userId);
    if (files?.length) {
      await admin.storage
        .from("avatars")
        .remove(files.map((f) => `${userId}/${f.name}`));
    }
  } catch (storageError) {
    console.error("avatar cleanup failed (continuing):", storageError);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) throw deleteError;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    // 1. Who is calling?
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return jsonResponse(401, { error: "Not signed in." });

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return jsonResponse(401, { error: "Not signed in." });
    }
    const callerId = userData.user.id;

    // 2. Are they an admin?
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("user_id", callerId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.is_admin !== true) {
      return jsonResponse(403, { error: "Not authorized." });
    }

    // 3. What do they want?
    let body: { action?: string; userId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body." });
    }
    if (body.action !== "delete") {
      return jsonResponse(400, { error: "Unknown action." });
    }
    const targetId = body.userId ?? "";
    if (!UUID_RE.test(targetId)) {
      return jsonResponse(400, { error: "userId must be a uuid." });
    }
    if (targetId === callerId) {
      return jsonResponse(400, {
        error: "Use in-app account deletion for your own account.",
      });
    }

    await deleteUser(targetId);
    console.log("admin-users: deleted", targetId, "by", callerId);
    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error("admin-users failed:", err);
    return jsonResponse(500, { error: "Action failed. Please try again." });
  }
});
