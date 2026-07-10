import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://drbzogwimvaziaydwqfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const { data: roles, error: errRoles } = await supabase.from('roles').select('*');
    if (errRoles) throw errRoles;
    console.log('--- ROLES ---');
    console.log(JSON.stringify(roles, null, 2));

    const { data: modules, error: errMods } = await supabase.from('modules').select('*');
    if (errMods) throw errMods;
    console.log('--- MODULES ---');
    console.log(JSON.stringify(modules, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
