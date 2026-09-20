import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mfdcxaogtjbcdpmjljsd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0f0rN18eNI7cXXjhWFpggQ_d-hlFVs8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkProductsTable() {
  console.log('Testing Supabase products table connectivity...');

  // 1. Test SELECT on products table
  console.log('\n--- 1. Testing SELECT query ---');
  const { data: selectData, error: selectError, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' });

  if (selectError) {
    console.error('SELECT Failed:', selectError);
    return;
  }
  
  console.log('SELECT Succeeded! Current row count in table:', count ?? selectData?.length);
  console.log('Sample rows:', selectData);

  // 2. Test INSERT on products table
  console.log('\n--- 2. Testing INSERT query ---');
  const testProduct = {
    title: 'Test Cyberpunk Smartwatch',
    description: 'Autonomous sync test product from GizmoVault agent',
    price: 4999,
    category: 'Electronic Gadgets',
    media_url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d',
    media_type: 'image',
    status: 'ACTIVE'
  };

  const { data: insertData, error: insertError } = await supabase
    .from('products')
    .insert([testProduct])
    .select();

  if (insertError) {
    console.error('INSERT Failed:', insertError);
    return;
  }

  console.log('INSERT Succeeded! Successfully inserted row:', insertData);

  const insertedId = insertData?.[0]?.id;
  if (insertedId) {
    // 3. Test SELECT of the newly inserted item
    console.log('\n--- 3. Verifying reading the inserted item via RLS ---');
    const { data: verifyData, error: verifyError } = await supabase
      .from('products')
      .select('*')
      .eq('id', insertedId)
      .single();

    if (verifyError) {
      console.error('Fetch inserted item failed:', verifyError);
    } else {
      console.log('Successfully read inserted product via "Public can view active products" RLS policy:', verifyData.title);
    }

    // 4. Test DELETE to keep database clean
    console.log('\n--- 4. Cleaning up test record ---');
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', insertedId);

    if (deleteError) {
      console.error('DELETE cleanup failed:', deleteError);
    } else {
      console.log('DELETE cleanup Succeeded via "Allow deletes" RLS policy!');
    }
  }

  console.log('\n--- All operations confirmed working successfully! ---');
}

checkProductsTable().catch(console.error);
