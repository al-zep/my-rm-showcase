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
    const { phone, otp, full_name, role } = await req.json();

    // Whitelist roles that can be set from client during signup
    const ALLOWED_SIGNUP_ROLES = new Set(["member", "student", "church_member"]);
    // Normalize: PWA passes the category id; map to canonical profile role
    const normalizeRole = (r: unknown): string | null => {
      if (typeof r !== "string") return null;
      const v = r.trim().toLowerCase();
      if (v === "church_member") return "member";
      if (ALLOWED_SIGNUP_ROLES.has(v)) return v;
      return null;
    };
    const requestedRole = normalizeRole(role);

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone and OTP are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("otp", otp)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired OTP" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Find or create user
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({ phone: normalizedPhone })
        .select()
        .single();

      if (userError) {
        console.error("User create error:", userError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = newUser;
    }

    // Generate access token (valid 7 days)
    const accessToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find or create profile
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          phone: normalizedPhone,
          full_name: full_name || "",
          role: requestedRole || "member",
          access_token: accessToken,
          token_expires_at: expiresAt,
        })
        .select()
        .single();

      if (profileError) {
        console.error("Profile create error:", profileError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      profile = newProfile;
    } else {
      // Update token and optionally full_name
      const updateData: Record<string, unknown> = {
        access_token: accessToken,
        token_expires_at: expiresAt,
      };
      if (full_name) {
        updateData.full_name = full_name;
      }

      const { data: updatedProfile } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id)
        .select()
        .single();

      if (updatedProfile) {
        profile = updatedProfile;
      }
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
    console.error("verify-otp error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
