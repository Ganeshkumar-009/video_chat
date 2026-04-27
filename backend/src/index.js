// Backend index - Socket handlers, Supabase init
const { createClient } = require('@supabase/supabase-js');

// Init Supabase Admin
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const signaling = require('./sockets/signaling');

module.exports = (io) => {
  signaling(io, supabaseAdmin);
};
