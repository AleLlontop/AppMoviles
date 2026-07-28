import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } })
  }

  try {
    const { userId, achievementId } = await req.json()

    if (!userId || !achievementId) {
      return new Response(JSON.stringify({ error: "Missing userId or achievementId" }), { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("authorization") || "" } }
    })

    // Verificar si ya está desbloqueado
    const { data: existing, error: checkError } = await supabase
      .from("user_achievements")
      .select("id")
      .eq("user_id", userId)
      .eq("achievement_id", achievementId)
      .single()

    if (existing) {
      return new Response(JSON.stringify({ already_unlocked: true }), { status: 200 })
    }

    // Usar service_role para bypassar RLS
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false }
    })

    const { error } = await supabaseAdmin
      .from("user_achievements")
      .insert({
        user_id: userId,
        achievement_id: achievementId,
        unlocked_at: new Date().toISOString(),
      })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
