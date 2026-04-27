const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jxaedtdahujzvyltbwci.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YWVkdGRhaHVqenZ5bHRid2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTgzMDAsImV4cCI6MjA4OTMzNDMwMH0.NKdN2GvzAd2jo7bB_xiE0PPTL41BkdIORty1XBCZp2k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
  console.log('Listing all tables in public schema...');
  // This is a hacky way to list tables if the user has access
  const { data, error } = await supabase.rpc('get_tables'); // Won't work unless defined
  
  if (error) {
    // Try to just select from a few likely names
    const tables = ['users', 'messages', 'profiles', 'conversations', 'chats'];
    for (const t of tables) {
      const { error: tErr } = await supabase.from(t).select('*').limit(0);
      if (!tErr) console.log(`Table found: ${t}`);
      else console.log(`Table NOT found or error in ${t}: ${tErr.message}`);
    }
  }
}

listTables();
