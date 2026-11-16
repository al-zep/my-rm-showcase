import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "255" + cleaned.slice(1);
  }
  if (!cleaned.startsWith("255")) {
    cleaned = "255" + cleaned;
  }
  return cleaned;
}

const PBKDF2_ITERATIONS = 210_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [algorithm, iterationsText, saltText, expectedHash] = storedHash.split("$");
    const iterations = Number(iterationsText);
    if (algorithm !== "pbkdf2_sha256" || !Number.isSafeInteger(iterations) || iterations < 1) {
      return false;
    }
    const salt = Uint8Array.from(atob(saltText), (character) => character.charCodeAt(0));
    const actualHash = await derivePasswordHash(password, salt, iterations);
    let difference = actualHash.length ^ expectedHash.length;
    const length = Math.max(actualHash.length, expectedHash.length);
    for (let index = 0; index < length; index += 1) {
      difference |= (actualHash.charCodeAt(index) || 0) ^ (expectedHash.charCodeAt(index) || 0);
    }
    return difference === 0;
  } catch {
    return false;
  }
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  for (const byte of array) {
    token += chars[byte % chars.length];
  }
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, password } = await req.json();

    if (!phone || typeof password !== "string" || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Namba ya simu na password zinahitajika." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (password.length > 128) {
      return new Response(
        JSON.stringify({ success: false, error: "Namba ya simu au password si sahihi." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find existing user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Namba hii haijasajiliwa. Tafadhali jisajili kwanza." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: credential, error: credentialError } = await supabase
      .from("user_credentials")
      .select("password_hash")
      .eq("user_id", user.id)
      .maybeSingle();

    if (credentialError) {
      console.error("Credential lookup error:", credentialError);
      return new Response(
        JSON.stringify({ success: false, error: "Imeshindwa kuthibitisha taarifa zako. Jaribu tena." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!credential) {
      return new Response(
        JSON.stringify({ success: false, error: "Akaunti hii haina password. Chagua Jisajili, thibitisha OTP, kisha tengeneza password." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!(await verifyPassword(password, credential.password_hash))) {
      return new Response(
        JSON.stringify({ success: false, error: "Namba ya simu au password si sahihi." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate access token (valid 7 days)
    const accessToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get profile and update token
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .update({ access_token: accessToken, token_expires_at: expiresAt })
        .eq("id", profile.id)
        .select()
        .single();
      if (updatedProfile) profile = updatedProfile;
    } else {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          phone: normalizedPhone,
          full_name: "",
          role: "member",
          access_token: accessToken,
          token_expires_at: expiresAt,
        })
        .select()
        .single();
      profile = newProfile;
    }

    // Super admin enforcement by phone
    const SUPER_ADMIN_PHONES = new Set(["255752519974", "255712686839"]);
    if (SUPER_ADMIN_PHONES.has(normalizedPhone) && profile) {
      await supabase.from("profiles").update({ role: "super_admin" }).eq("id", profile.id);
      profile.role = "super_admin";
      await supabase
        .from("user_roles")
        .upsert({ user_id: profile.id, role: "super_admin" }, { onConflict: "user_id,role" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        access_token: accessToken,
        expires_at: expiresAt,
        user_id: user.id,
        user: {
          id: user.id,
          phone: normalizedPhone,
          full_name: profile?.full_name || "",
          role: profile?.role || "member",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sign-in error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
