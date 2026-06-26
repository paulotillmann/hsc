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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  try {
    // 1. Listar módulos da tabela modules
    const { data: modules, error: modError } = await supabase
      .from('modules')
      .select('*');
      
    if (modError) {
      console.error('Erro ao ler modules:', modError);
    } else {
      console.log('\n=== MÓDULOS CADASTRADOS (modules) ===');
      console.table(modules.map(m => ({ id: m.id, name: m.name, slug: m.slug, is_active: m.is_active })));
    }

    // 2. Listar roles cadastrados
    const { data: roles, error: roleError } = await supabase
      .from('roles')
      .select('*');
      
    if (roleError) {
      console.error('Erro ao ler roles:', roleError);
    } else {
      console.log('\n=== ROLES CADASTRADOS (roles) ===');
      console.table(roles.map(r => ({ id: r.id, name: r.name, description: r.description })));
    }

    // 3. Listar role_module_permissions
    const { data: permissions, error: permError } = await supabase
      .from('role_module_permissions')
      .select('*, roles(name), modules(name, slug)');
      
    if (permError) {
      console.error('Erro ao ler role_module_permissions:', permError);
    } else {
      console.log('\n=== PERMISSÕES DE MÓDULOS (role_module_permissions) ===');
      console.table(permissions.map(p => ({
        id: p.id,
        role: p.roles?.name || p.role_id,
        module_name: p.modules?.name || p.module_id,
        module_slug: p.modules?.slug
      })));
    }

    // 4. Listar profiles cadastrados
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('*, roles(name)');
      
    if (profError) {
      console.error('Erro ao ler profiles:', profError);
    } else {
      console.log('\n=== PERFIS DE USUÁRIOS (profiles) ===');
      console.table(profiles.map(p => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        role_name: p.roles?.name || p.role_id,
        default_module: p.default_module_slug
      })));
    }

  } catch (err) {
    console.error('Erro geral:', err);
  }
}

diagnose();
