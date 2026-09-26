import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

const users = [
  { email: 'khalid@mdrar.sa', password: 'password', metadata: { role: 'super_admin', full_name: 'خالد الشهري', full_name_en: 'Khalid Al-Shehri' } },
  { email: 'sarah@mdrar.sa', password: 'password', metadata: { role: 'facility_manager', full_name: 'Sarah Miller', full_name_en: 'Sarah Miller' } },
  { email: 'salem@mdrar.sa', password: 'password', metadata: { role: 'technician', full_name: 'سالم القحطاني', full_name_en: 'Salem Al-Qahtani', specialty: 'AC & Plumbing' } },
  { email: 'fahad@mdrar.sa', password: 'password', metadata: { role: 'technician', full_name: 'فهد العتيبي', full_name_en: 'Fahad Al-Otaibi', specialty: 'Electrical' } },
  { email: 'owner@mdrar.sa', password: 'password', metadata: { role: 'owner', full_name: 'عبدالرحمن الراجحي', full_name_en: 'Abdulrahman Al-Rajhi' } },
  { email: 'pm@mdrar.sa', password: 'password', metadata: { role: 'pm_manager', full_name: 'مدير المشاريع', full_name_en: 'PM Manager' } },
  { email: 'pmviewer@mdrar.sa', password: 'password', metadata: { role: 'pm_viewer', full_name: 'مشاهد المشاريع', full_name_en: 'PM Viewer' } },
  { email: 'm.alotaibi@example.com', password: 'password', metadata: { role: 'tenant', full_name: 'محمد العتيبي', full_name_en: 'Mohammed Al-Otaibi', tenant_unit: 'A-204' } },
  { email: 'sarah.j@example.com', password: 'password', metadata: { role: 'tenant', full_name: 'Sarah Johnson', full_name_en: 'Sarah Johnson', tenant_unit: 'B-110' } },
];

for (const u of users) {
  const { error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: u.metadata,
  });
  console.log(u.email, error ? `FAILED: ${error.message}` : 'created');
}

// Link tenants to their properties (run after seed data from 01_SUPABASE_BACKEND.md §19 exists)
const { data: jazly } = await supabase.from('properties').select('id').eq('name_en', 'Jazly Plaza').single();
const { data: qurtuba } = await supabase.from('properties').select('id').eq('name_en', 'Wahat Qurtuba').single();

if (jazly) {
  await supabase.from('profiles').update({ tenant_property_id: jazly.id }).eq('email', 'm.alotaibi@example.com');
  console.log('Linked m.alotaibi to Jazly Plaza');
}
if (qurtuba) {
  await supabase.from('profiles').update({ tenant_property_id: qurtuba.id }).eq('email', 'sarah.j@example.com');
  console.log('Linked sarah.j to Wahat Qurtuba');
}
