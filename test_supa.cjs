require('dotenv').config({path: '.env'}); 
const { createClient } = require('@supabase/supabase-js'); 
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY); 
s.from('visitantes').select('*').eq('terceiro', true).limit(2).then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
