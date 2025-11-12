# 🎮 Gaming Time Finder

A web application that helps you and your friends find the perfect time to game together by automatically detecting overlapping free time slots and suggesting the best gaming sessions.

## Features

- ✨ **Interactive Time Block Editor**: Drag and drop time blocks to mark your availability
- 📅 **Google Calendar Integration**: Connect your Google Calendar to automatically sync your free time
- 🤖 **Smart Algorithm**: Automatically finds overlapping time slots and ranks them (evenings > mornings)
- 🎯 **Preferred Games**: Add your favorite games and get suggestions for both time and what to play
- 🔔 **Discord Notifications**: Get notified when a new gaming session is scheduled
- 💾 **Backend Storage**: Uses Supabase for persistent data storage (required for production)

## Tech Stack

- **Backend**: Python Flask
- **Frontend**: HTML, CSS, JavaScript
- **Containerization**: Docker
- **Database**: Supabase (required for production, in-memory fallback for local dev)

## Quick Start

### Using Docker (Recommended)

1. **Clone and navigate to the project**:
   ```bash
   cd Gamingv2AnotherAngle
   ```

2. **Set up environment variables** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3006`

### Manual Setup

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run the Flask app**:
   ```bash
   python app.py
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3006`

## Configuration

### Google Calendar Integration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials
5. Add the credentials to your `.env` file:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3006/auth/callback
   ```

### Discord Notifications

1. Go to your Discord server settings
2. Navigate to Integrations > Webhooks
3. Create a new webhook and copy the URL
4. Add it to your `.env` file:
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_url
   ```

### Supabase Setup (Required for Production)

**⚠️ Important**: Supabase is required for production deployments. The app will work without it locally using in-memory storage, but data will be lost on restart.

1. **Create a Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project (free tier works fine)
   - Wait for the project to finish setting up

2. **Get your credentials**:
   - Go to Project Settings > API
   - Copy your "Project URL" and "anon/public" key

3. **Add to your `.env` file**:
   ```bash
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your_anon_public_key_here
   ```

4. **Set up the database schema**:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase_schema.sql` (included in this repo)
   - Run the SQL script to create all required tables
   
   Or manually create the tables using the SQL in `supabase_schema.sql`

5. **Verify setup**:
   - When you start the app, you should see: `✅ Supabase connected successfully`
   - If you see a warning, check your credentials and table setup

## Usage

1. **Create Your Profile**:
   - Enter a unique user ID and your name
   - Click "Set Profile"

2. **Set Your Availability**:
   - Click on the time slots to add available time blocks
   - Drag blocks to adjust times
   - Click "Save Availability"

3. **Connect Google Calendar** (Optional):
   - Click "Connect Calendar" to authorize
   - Click "Sync Calendar" to import your free time

4. **Add Preferred Games**:
   - Type game names and click "Add Game"
   - Click "Save Games"

5. **Find Gaming Time**:
   - Enter your friend's user ID
   - Click "Find Best Time"
   - Review the suggested time slots
   - Click "Schedule This Time" to confirm

## API Endpoints

- `POST /api/users` - Create a new user
- `POST /api/availability` - Set user availability
- `GET /api/availability/<user_id>` - Get user availability
- `POST /api/find-slots` - Find overlapping time slots
- `POST /api/games` - Set preferred games
- `GET /api/games/<user_id>` - Get preferred games
- `GET /api/google-calendar/auth` - Initiate Google Calendar OAuth
- `POST /api/google-calendar/sync/<user_id>` - Sync Google Calendar
- `POST /api/schedule-session` - Schedule a gaming session

## Algorithm

The app uses a smart ranking system to suggest the best gaming times:

1. **Time Preference**: Evenings (6 PM - 11 PM) are ranked highest, followed by afternoons, mornings, and nights
2. **Duration**: Longer available slots are preferred
3. **Game Matching**: If both users have common preferred games, those are suggested

## Development

The app uses in-memory storage by default. For production, configure Supabase for persistent storage.

## License

MIT License - feel free to use and modify!

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

