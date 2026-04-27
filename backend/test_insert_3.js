const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jxaedtdahujzvyltbwci.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YWVkdGRhaHVqenZ5bHRid2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTgzMDAsImV4cCI6MjA4OTMzNDMwMH0.NKdN2GvzAd2jo7bB_xiE0PPTL41BkdIORty1XBCZp2k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log('Testing insert with username/text...');
  const { error } = await supabase
    .from('messages')
    .insert([{ 
      username: 'gannu_009', 
      text: 'test message', 
      room_id: 'test_room' 
    }]);
    
  if (error) {
    console.error('Error info:', error.message);
  } else {
    console.log('Insert SUCCESS! Columns are username, text, room_id.');
  }
}

testInsert();
