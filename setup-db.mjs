import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qaemzzpyrmoopfkiciki.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZW16enB5cm1vb3Bma2ljaWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODgwOSwiZXhwIjoyMDkxMDc0ODA5fQ.oi57C-ewm3N4-AActYJ3H9uzk6fZjM_SPz_3_pmPmhw'
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
  const res = await fetch('https://qaemzzpyrmoopfkiciki.supabase.co/rest/v1/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZW16enB5cm1vb3Bma2ljaWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODgwOSwiZXhwIjoyMDkxMDc0ODA5fQ.oi57C-ewm3N4-AActYJ3H9uzk6fZjM_SPz_3_pmPmhw',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZW16enB5cm1vb3Bma2ljaWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODgwOSwiZXhwIjoyMDkxMDc0ODA5fQ.oi57C-ewm3N4-AActYJ3H9uzk6fZjM_SPz_3_pmPmhw',
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
