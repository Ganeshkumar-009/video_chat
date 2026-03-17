const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_supabase')) {
  console.error('❌ Supabase credentials not set! Please update your .env file with real SUPABASE_URL and SUPABASE_KEY.');
  // We still initialize with placeholders to avoid crashing on import, 
  // but most operations will fail, alerting the user to the missing config.
  supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = supabase;
