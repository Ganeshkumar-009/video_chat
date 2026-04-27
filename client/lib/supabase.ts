import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jxaedtdahujzvyltbwci.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YWVkdGRhaHVqenZ5bHRid2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTgzMDAsImV4cCI6MjA4OTMzNDMwMH0.NKdN2GvzAd2jo7bB_xiE0PPTL41BkdIORty1XBCZp2k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

