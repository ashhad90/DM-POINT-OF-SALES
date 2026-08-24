import pg from 'pg'
const { Client } = pg

const host = 'aws-0-ap-northeast-2.pooler.supabase.com'
const username = 'postgres.bvjtwpulckvlssppgpcd'
const database = 'postgres'
const port = 6543
const password = 'gmqaBhK6@90'

async function run() {
  const client = new Client({
    host,
    user: username,
    password,
    database,
    port,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected!')

    console.log('Inserting dummy user to trigger handle_new_user()...')
    const query = `
      insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values (
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'test_trigger@pos.local',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"admin","full_name":"Test User"}',
        now(),
        now()
      )
    `
    const res = await client.query(query)
    console.log('Inserted successfully!', res.rowCount)

    await client.end()
  } catch (err) {
    console.error('ERROR DETECTED:', err.message)
    if (err.detail) console.error('DETAIL:', err.detail)
    if (err.hint) console.error('HINT:', err.hint)
    try { await client.end() } catch (e) {}
  }
}

run()
