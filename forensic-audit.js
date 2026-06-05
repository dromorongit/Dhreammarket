const { Client } = require('pg');

async function forensicAudit() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway' 
  });
  
  await client.connect();
  
  try {
    // Exact column list for each table
    console.log('=== vendor_verification_applications columns (EXACT) ===');
    const appCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='vendor_verification_applications' ORDER BY ordinal_position`);
    console.log(appCols.rows.map(x => `'${x.column_name}'`).join(', '));
    
    console.log('\n=== vendor_verification_kyc columns (EXACT) ===');
    const kycCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='vendor_verification_kyc' ORDER BY ordinal_position`);
    console.log(kycCols.rows.map(x => `'${x.column_name}'`).join(', '));
    
    console.log('\n=== verification_payments columns (EXACT) ===');
    const payCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='verification_payments' ORDER BY ordinal_position`);
    console.log(payCols.rows.map(x => `'${x.column_name}'`).join(', '));
    
    console.log('\n=== verification_audit_logs columns (EXACT) ===');
    const logCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='verification_audit_logs' ORDER BY ordinal_position`);
    console.log(logCols.rows.map(x => `'${x.column_name}'`).join(', '));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

forensicAudit();