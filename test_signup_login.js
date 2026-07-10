import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const email = 'admin@hsc.com';
  const password = 'Admin123!';

  console.log("Signing up user:", email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: 'Admin User', telefone: '123456789' }
    }
  });

  if (signUpError) {
    console.log("SignUp error (might be already registered):", signUpError.message);
  } else {
    console.log("SignUp success, user ID:", signUpData.user?.id);
  }

  console.log("Signing in user:", email);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error("SignIn error:", signInError);
    return;
  }

  const userId = signInData.user?.id;
  console.log("SignIn success! User ID:", userId);

  // Let's check if a profile exists now
  const { data: profile, error: pError } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (pError) {
    console.log("Profile error (not created or not queryable):", pError.message);
  } else {
    console.log("Existing profile:", profile);
  }

  // Try updating the profile to have role = 'admin'
  console.log("Updating profile to admin...");
  const { data: updateData, error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId)
    .select();

  if (updateError) {
    console.error("Update error:", updateError.message);
  } else {
    console.log("Update success!", updateData);
  }
}

main();
