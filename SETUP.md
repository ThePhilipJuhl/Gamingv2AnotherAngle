# Quick Setup Guide for Supabase

## Step 1: Create Supabase Tables

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the entire contents of `supabase_schema.sql`
5. Click "Run" (or press Cmd/Ctrl + Enter)

This will create all the required tables:
- `users` - Stores user profiles
- `availability` - Stores time availability slots
- `preferred_games` - Stores user's preferred games
- `google_credentials` - Stores Google Calendar OAuth tokens (optional)

## Step 2: Verify Your .env File

Make sure your `.env` file has:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_anon_public_key_here
```

## Step 3: Test the Connection

1. Start your app: `docker compose up --build`
2. Check the logs - you should see: `✅ Supabase connected successfully`
3. If you see an error, check:
   - Your Supabase URL and key are correct
   - The tables were created successfully
   - Your Supabase project is active

## Troubleshooting

**Error: "relation does not exist"**
- You need to run the SQL schema file first
- Go to SQL Editor and run `supabase_schema.sql`

**Error: "new row violates row-level security policy"**
- The RLS policies should allow all operations by default
- Check that the policies were created correctly in the schema

**Error: "invalid API key"**
- Double-check your SUPABASE_KEY in the .env file
- Make sure you're using the "anon/public" key, not the service_role key

