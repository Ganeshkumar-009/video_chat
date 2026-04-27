import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://niqgrlklnpwkorfpxrln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pcWdybGtsbnB3a29yZnB4cmxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc0ODM3OSwiZXhwIjoyMDg5MzI0Mzc5fQ.AP4N1NPEzUPzmptZonMt5H7tKaBH_PwFePDeyLkOI1k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

