import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Answer the browser's preflight before doing anything else
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader ?? '' } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await callerClient
      .from('profiles').select('role').eq('id', caller.id).single();
    const allowedRoles = ['super_admin', 'facility_manager', 'owner'];
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { email, fullName, role, password, tenantPropertyId, tenantUnit, leaseId } = await req.json();
    if (!email || !role) return json({ error: 'email and role are required' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // Look up the existing profile by email instead of listing all auth users
    // (listUsers() is paginated and would miss users past the first page)
    const { data: existingProfile } = await admin
      .from('profiles').select('id').ilike('email', email).maybeSingle();
    let userId = existingProfile?.id as string | undefined;

    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: password ?? '123456',
        email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);
      userId = created.user.id;
    }

    const { error: upsertErr } = await admin.from('profiles').upsert({
      id: userId,
      full_name: fullName ?? email,
      email,
      role,
      tenant_property_id: tenantPropertyId ?? null,
      tenant_unit: tenantUnit ?? null,
    });
    if (upsertErr) return json({ error: upsertErr.message }, 400);

    if (leaseId) {
      await admin.from('leases').update({ tenant_id: userId }).eq('id', leaseId);
    }

    return json({ userId });
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Internal error' }, 500);
  }
});