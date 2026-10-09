import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {handler} from './fluxo.mjs';
const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(handler(sb));
