import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjajkxrbzsftmzwjrnho.supabase.co';
const supabaseKey = 'sb_publishable_ctIegqNBpnBeb1V_AEdoEg_K8cYehq9';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Inserting test user...');
  const { data: iData, error: iError } = await supabase.from('users').insert([
    {
      user_id: 'TEST-123',
      username: 'Test User',
      pin_hash: 'abc',
      role: 'primary'
    }
  ]);
  
  console.log('Insert Error:', iError);
  
  console.log('Fetching user...');
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
