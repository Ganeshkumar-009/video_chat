const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jxaedtdahujzvyltbwci.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YWVkdGRhaHVqenZ5bHRid2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTgzMDAsImV4cCI6MjA4OTMzNDMwMH0.NKdN2GvzAd2jo7bB_xiE0PPTL41BkdIORty1XBCZp2k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log('Testing insert with common names...');
  const { error } = await supabase
    .from('messages')
    .insert([{ 
      from_id: '01e7a177-9fbe-4484-ae34-baa9b1bca10b', 
      to_id: '31955d6f-8102-4271-89e9-b9d2b4f90429', 
      message: 'test message', 
      room_id: 'test_room' 
    }]);
    
  if (error) {
    console.error('Error info:', error.message);
  } else {
    console.log('Insert SUCCESS! Columns are from_id, to_id, message, room_id.');
  }
}

testInsert();
