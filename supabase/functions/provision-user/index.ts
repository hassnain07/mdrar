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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is authenticated and has an allowed role
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
    const finalPassword = password ?? '123456';

    // Step 1: find existing auth user by scanning profiles (fast path)
    // then falling back to listUsers if not found
    let userId: string | undefined;

    const { data: existingProfile } = await admin
      .from('profiles').select('id').ilike('email', email).limit(1).maybeSingle();

    if (existingProfile?.id) {
      // User already fully exists — just update password and profile below
      userId = existingProfile.id;
      await admin.auth.admin.updateUserById(userId, { password: finalPassword });
    } else {
      // Step 2: try to create the auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName ?? email, role },
      });

      if (!createErr) {
        // Newly created — trigger handle_new_auth_user will insert the profile row
        userId = created.user.id;
      } else {
        // Email already exists in auth.users but has no profile row
        // Scan listUsers to find the id (paginated but only runs in this edge case)
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const found = list?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (!found) return json({ error: createErr.message }, 400);
        userId = found.id;
        await admin.auth.admin.updateUserById(userId, { password: finalPassword });
      }
    }

    // Step 3: upsert the profile with the correct role/name
    // (covers both the existing-user case and the orphaned-auth-user case)
    const { error: upsertErr } = await admin.from('profiles').upsert({
      id: userId,
      full_name: fullName ?? email,
      email,
      role,
      tenant_property_id: tenantPropertyId ?? null,
      tenant_unit: tenantUnit ?? null,
    });
    if (upsertErr) return json({ error: upsertErr.message }, 400);

    // Step 4: also ensure a preferences row exists
    await admin.from('preferences').upsert({ profile_id: userId });

    if (leaseId) {
      await admin.from('leases').update({ tenant_id: userId }).eq('id', leaseId);
    }

    return json({ userId });
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Internal error' }, 500);
  }
});
