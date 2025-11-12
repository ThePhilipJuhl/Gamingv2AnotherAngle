-- Supabase Database Schema for Gaming Time Finder
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Availability table
CREATE TABLE IF NOT EXISTS availability (
    user_id TEXT PRIMARY KEY,
    slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Preferred games table
CREATE TABLE IF NOT EXISTS preferred_games (
    user_id TEXT PRIMARY KEY,
    games JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google Calendar credentials table (optional, for storing OAuth tokens)
CREATE TABLE IF NOT EXISTS google_credentials (
    user_id TEXT PRIMARY KEY,
    credentials JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_availability_updated_at ON availability(updated_at);
CREATE INDEX IF NOT EXISTS idx_preferred_games_updated_at ON preferred_games(updated_at);

-- Enable Row Level Security (RLS) - adjust policies as needed for your use case
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferred_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your security needs)
-- For a public app, you might want to restrict this further
CREATE POLICY "Allow all operations on users" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on availability" ON availability
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on preferred_games" ON preferred_games
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on google_credentials" ON google_credentials
    FOR ALL USING (true) WITH CHECK (true);

