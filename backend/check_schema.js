const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jxaedtdahujzvyltbwci.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YWVkdGRhaHVqenZ5bHRid2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTgzMDAsImV4cCI6MjA4OTMzNDMwMH0.NKdN2GvzAd2jo7bB_xiE0PPTL41BkdIORty1XBCZp2k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log('Fetching first row from messages to check columns...');
  const { data, error } = await supabase.from('messages').select('*').limit(1);
  
  if (error) {
    console.error('Error fetching messages:', error);
  } else {
    console.log('Columns found:', data.length > 0 ? Object.keys(data[0]) : 'Table is empty, trying to fetch from another way...');
    
    if (data.length === 0) {
      // Try to insert a dummy row to see what happens or just fetch one from another table
      console.log('Table is empty. Checking users table columns instead for consistency...');
      const { data: userData } = await supabase.from('users').select('*').limit(1);
      console.log('Users columns:', Object.keys(userData[0]));
    }
  }
}

checkSchema();
