// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function (Deno) – generates a Stitch link URL (placeholder)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: any, init: ResponseInit = {}) {
  const headers = { "Content-Type": "application/json", ...corsHeaders, ...(init.headers || {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_id, institution_id } = await req.json();
    if (!company_id) return jsonResponse({ error: "Missing company_id" }, { status: 400 });

    const clientId = Deno.env.get("STITCH_CLIENT_ID");
    const clientSecret = Deno.env.get("STITCH_CLIENT_SECRET");
    const redirectUrl = Deno.env.get("STITCH_REDIRECT_URL") || "http://localhost:8083/";

    if (!clientId || !clientSecret) {
      // Placeholder response to unblock UI without secrets yet
      return jsonResponse({
        link_url: `${redirectUrl}#stitch-link-placeholder?institution=${institution_id || "unknown"}`,
        note: "Configure STITCH_CLIENT_ID and STITCH_CLIENT_SECRET to enable real linking",
      });
    }

    // TODO: Replace with real Stitch Link Token creation API call
    // Example placeholder simulating token creation
    const fakeToken = crypto.randomUUID();
    const linkUrl = `${redirectUrl}#stitch-link-token=${fakeToken}&institution=${institution_id || "unknown"}`;

    return jsonResponse({ link_url: linkUrl });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
});