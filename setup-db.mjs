import { createClient } from '@supabase/supabase-js';

// Les identifiants viennent de l'environnement — jamais du dépôt.
// La clé service_role contourne toutes les RLS : elle ne doit exister que dans .env.local.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY avant de lancer ce script.');
  process.exit(1);
}


const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY
);

// Create storage bucket
async function setupStorage() {
  const { data, error } = await supabase.storage.createBucket('request-images', {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
  });
  if (error) {
    if (error.message?.includes('already exists')) {
      console.log('✓ Bucket "request-images" exists already');
    } else {
      console.error('✗ Bucket error:', error.message);
    }
  } else {
    console.log('✓ Bucket "request-images" created');
  }
}

// Run SQL via the Supabase SQL API
async function runSQL(sql, label) {
  const res = await fetch('${SUPABASE_URL}/rest/v1/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (res.ok) {
    console.log(`✓ ${label}`);
  } else {
    const text = await res.text();
    console.log(`? ${label}: ${text}`);
  }
}

async function main() {
  console.log('Setting up Supabase...\n');

  // Setup storage bucket
  await setupStorage();

  // Test: try inserting a row to see if tables exist
  const { error } = await supabase.from('requests').select('id').limit(1);
  if (!error) {
    console.log('✓ Tables already exist');
    console.log('\n✅ Setup complete! Tables and bucket are ready.');
    return;
  }

  console.log('Tables not found. You need to run the SQL schema manually.');
  console.log('\nGo to: https://supabase.com/dashboard/project/qaemzzpyrmoopfkiciki/sql/new');
  console.log('Paste the contents of supabase-schema.sql and click "Run"');
}

main().catch(console.error);
