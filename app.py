from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import json

# Google Calendar imports
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Supabase (optional - can use in-memory for demo)
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

# Configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:3006/auth/callback')
DISCORD_WEBHOOK_URL = os.getenv('DISCORD_WEBHOOK_URL', '')
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')

# Initialize Supabase (required)
supabase_client = None
if not SUPABASE_AVAILABLE:
    raise ImportError("Supabase package not installed. Install with: pip install supabase")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

try:
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase connected successfully")
except Exception as e:
    raise ConnectionError(f"Failed to connect to Supabase: {e}")


# Helper functions for Supabase operations
def get_user_from_db(user_id):
    """Get user from Supabase"""
    try:
        result = supabase_client.table('users').select('*').eq('user_id', user_id).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"Error fetching user from Supabase: {e}")
        raise


def save_user_to_db(user_id, name, created_at=None):
    """Save user to Supabase"""
    if created_at is None:
        created_at = datetime.now().isoformat()
    
    try:
        result = supabase_client.table('users').upsert({
            'user_id': user_id,
            'name': name,
            'created_at': created_at
        }).execute()
        print(f"✅ Saved user {user_id} to Supabase")
    except Exception as e:
        print(f"❌ Error saving user to Supabase: {e}")
        import traceback
        traceback.print_exc()
        raise


def get_availability_from_db(user_id):
    """Get availability from Supabase"""
    try:
        result = supabase_client.table('availability').select('*').eq('user_id', user_id).execute()
        if result.data and result.data[0].get('slots'):
            return json.loads(result.data[0]['slots'])
        return []
    except Exception as e:
        print(f"Error fetching availability from Supabase: {e}")
        raise


def save_availability_to_db(user_id, slots):
    """Save availability to Supabase"""
    try:
        result = supabase_client.table('availability').upsert({
            'user_id': user_id,
            'slots': json.dumps(slots),
            'updated_at': datetime.now().isoformat()
        }).execute()
        print(f"✅ Saved availability for {user_id} to Supabase ({len(slots)} slots)")
    except Exception as e:
        print(f"❌ Error saving availability to Supabase: {e}")
        import traceback
        traceback.print_exc()
        raise


def get_games_from_db(user_id):
    """Get preferred games from Supabase"""
    try:
        result = supabase_client.table('preferred_games').select('*').eq('user_id', user_id).execute()
        if result.data and result.data[0].get('games'):
            return json.loads(result.data[0]['games'])
        return []
    except Exception as e:
        print(f"Error fetching games from Supabase: {e}")
        raise


def save_games_to_db(user_id, games):
    """Save preferred games to Supabase"""
    try:
        result = supabase_client.table('preferred_games').upsert({
            'user_id': user_id,
            'games': json.dumps(games),
            'updated_at': datetime.now().isoformat()
        }).execute()
        print(f"✅ Saved games for {user_id} to Supabase ({len(games)} games)")
    except Exception as e:
        print(f"❌ Error saving games to Supabase: {e}")
        import traceback
        traceback.print_exc()
        raise

# Google Calendar OAuth flow
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
flow = None

if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI]
            }
        },
        scopes=SCOPES
    )
    flow.redirect_uri = GOOGLE_REDIRECT_URI


def get_time_score(start_time):
    """Rank time slots: evenings (18-23) > afternoons (12-18) > mornings (6-12) > nights (0-6)"""
    hour = start_time.hour
    if 18 <= hour < 23:
        return 4  # Evening - best for gaming
    elif 12 <= hour < 18:
        return 3  # Afternoon
    elif 6 <= hour < 12:
        return 2  # Morning
    else:
        return 1  # Night


def find_overlapping_slots(user1_slots, user2_slots):
    """Find overlapping time slots between two users"""
    overlaps = []
    
    for slot1 in user1_slots:
        start1 = datetime.fromisoformat(slot1['start'])
        end1 = datetime.fromisoformat(slot1['end'])
        
        for slot2 in user2_slots:
            start2 = datetime.fromisoformat(slot2['start'])
            end2 = datetime.fromisoformat(slot2['end'])
            
            # Find overlap
            overlap_start = max(start1, start2)
            overlap_end = min(end1, end2)
            
            if overlap_start < overlap_end:
                duration = (overlap_end - overlap_start).total_seconds() / 3600  # hours
                if duration >= 1:  # At least 1 hour
                    overlaps.append({
                        'start': overlap_start.isoformat(),
                        'end': overlap_end.isoformat(),
                        'duration': duration,
                        'score': get_time_score(overlap_start)
                    })
    
    # Sort by score (evening preference) and duration
    overlaps.sort(key=lambda x: (-x['score'], -x['duration']))
    return overlaps


@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user"""
    data = request.json
    user_id = data.get('user_id')
    name = data.get('name', 'User')
    
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    
    save_user_to_db(user_id, name)
    return jsonify({'user_id': user_id, 'name': name})


@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """Get user information"""
    try:
        user = get_user_from_db(user_id)
        if user:
            return jsonify({'user_id': user_id, 'name': user.get('name', user_id)})
        else:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/availability', methods=['POST'])
def set_availability():
    """Set availability for a user"""
    data = request.json
    user_id = data.get('user_id')
    slots = data.get('slots', [])
    
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    
    save_availability_to_db(user_id, slots)
    return jsonify({'user_id': user_id, 'slots': slots})


@app.route('/api/availability/<user_id>', methods=['GET'])
def get_availability(user_id):
    """Get availability for a user"""
    slots = get_availability_from_db(user_id)
    return jsonify({'user_id': user_id, 'slots': slots})


@app.route('/api/find-slots', methods=['POST'])
def find_slots():
    """Find overlapping time slots between two users"""
    data = request.json
    user1_id = data.get('user1_id')
    user2_id = data.get('user2_id')
    
    if not user1_id or not user2_id:
        return jsonify({'error': 'Both user1_id and user2_id required'}), 400
    
    user1_slots = get_availability_from_db(user1_id)
    user2_slots = get_availability_from_db(user2_id)
    
    if not user1_slots or not user2_slots:
        return jsonify({'error': 'Both users must have availability set'}), 400
    
    overlaps = find_overlapping_slots(user1_slots, user2_slots)
    
    # Get preferred games
    user1_games = get_games_from_db(user1_id)
    user2_games = get_games_from_db(user2_id)
    common_games = list(set(user1_games) & set(user2_games))
    
    result = {
        'overlaps': overlaps,
        'best_slot': overlaps[0] if overlaps else None,
        'common_games': common_games,
        'suggested_game': common_games[0] if common_games else None
    }
    
    return jsonify(result)


@app.route('/api/games', methods=['POST'])
def set_preferred_games():
    """Set preferred games for a user"""
    data = request.json
    user_id = data.get('user_id')
    games = data.get('games', [])
    
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    
    save_games_to_db(user_id, games)
    return jsonify({'user_id': user_id, 'games': games})


@app.route('/api/games/<user_id>', methods=['GET'])
def get_preferred_games(user_id):
    """Get preferred games for a user"""
    games = get_games_from_db(user_id)
    return jsonify({'user_id': user_id, 'games': games})


@app.route('/api/google-calendar/auth', methods=['GET'])
def google_calendar_auth():
    """Initiate Google Calendar OAuth flow"""
    if not flow:
        return jsonify({'error': 'Google Calendar not configured'}), 400
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    return jsonify({'auth_url': authorization_url, 'state': state})


@app.route('/api/google-calendar/callback', methods=['GET'])
def google_calendar_callback():
    """Handle Google Calendar OAuth callback"""
    code = request.args.get('code')
    state = request.args.get('state')
    user_id = request.args.get('user_id')
    
    if not code or not user_id:
        return jsonify({'error': 'Missing code or user_id'}), 400
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Store credentials securely in Supabase
        creds_dict = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        
        try:
            supabase_client.table('google_credentials').upsert({
                'user_id': user_id,
                'credentials': json.dumps(creds_dict),
                'updated_at': datetime.now().isoformat()
            }).execute()
        except Exception as e:
            print(f"Error saving Google credentials to Supabase: {e}")
            raise
        
        return jsonify({'success': True, 'message': 'Google Calendar connected'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/google-calendar/sync/<user_id>', methods=['POST'])
def sync_google_calendar(user_id):
    """Sync availability from Google Calendar"""
    # Get credentials from Supabase
    creds_dict = None
    
    try:
        result = supabase_client.table('google_credentials').select('*').eq('user_id', user_id).execute()
        if result.data and result.data[0].get('credentials'):
            creds_dict = json.loads(result.data[0]['credentials'])
    except Exception as e:
        print(f"Error fetching Google credentials from Supabase: {e}")
        return jsonify({'error': 'Failed to fetch Google Calendar credentials'}), 500
    
    if not creds_dict:
        return jsonify({'error': 'Google Calendar not connected'}), 400
    
    try:
        credentials = Credentials(
            token=creds_dict['token'],
            refresh_token=creds_dict['refresh_token'],
            token_uri=creds_dict['token_uri'],
            client_id=creds_dict['client_id'],
            client_secret=creds_dict['client_secret'],
            scopes=creds_dict['scopes']
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        
        # Get events for the next 7 days
        now = datetime.utcnow()
        time_min = now.isoformat() + 'Z'
        time_max = (now + timedelta(days=7)).isoformat() + 'Z'
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Calculate free time slots
        free_slots = []
        current_time = now
        
        for event in events:
            start_str = event['start'].get('dateTime', event['start'].get('date'))
            end_str = event['end'].get('dateTime', event['end'].get('date'))
            
            event_start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            event_end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            
            # Convert to local time (simplified - adjust as needed)
            event_start = event_start.replace(tzinfo=None)
            event_end = event_end.replace(tzinfo=None)
            
            if current_time < event_start:
                # Free slot before event
                free_slots.append({
                    'start': current_time.isoformat(),
                    'end': event_start.isoformat()
                })
            
            current_time = max(current_time, event_end)
        
        # Add remaining time until end of week
        week_end = now + timedelta(days=7)
        if current_time < week_end:
            free_slots.append({
                'start': current_time.isoformat(),
                'end': week_end.isoformat()
            })
        
        # Filter slots that are at least 1 hour
        free_slots = [
            slot for slot in free_slots
            if (datetime.fromisoformat(slot['end']) - datetime.fromisoformat(slot['start'])).total_seconds() >= 3600
        ]
        
        # Save to database
        save_availability_to_db(user_id, free_slots)
        
        return jsonify({'user_id': user_id, 'slots': free_slots})
    
    except HttpError as e:
        return jsonify({'error': f'Google Calendar API error: {e}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/schedule-session', methods=['POST'])
def schedule_session():
    """Schedule a gaming session and send notifications"""
    data = request.json
    user1_id = data.get('user1_id')
    user2_id = data.get('user2_id')
    slot = data.get('slot')
    game = data.get('game')
    
    if not all([user1_id, user2_id, slot]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Send Discord notification
    if DISCORD_WEBHOOK_URL:
        try:
            import requests
            # Get user names from database
            user1 = get_user_from_db(user1_id)
            user2 = get_user_from_db(user2_id)
            user1_name = user1.get('name', user1_id) if user1 else user1_id
            user2_name = user2.get('name', user2_id) if user2 else user2_id
            
            message = f"🎮 **Gaming Session Scheduled!**\n\n"
            message += f"**Time:** {slot['start']} - {slot['end']}\n"
            message += f"**Players:** {user1_name} & {user2_name}\n"
            if game:
                message += f"**Game:** {game}\n"
            
            requests.post(DISCORD_WEBHOOK_URL, json={'content': message})
        except Exception as e:
            print(f"Discord notification error: {e}")
    
    return jsonify({
        'success': True,
        'message': 'Session scheduled',
        'slot': slot,
        'game': game
    })


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})


@app.route('/api/debug/supabase', methods=['GET'])
def debug_supabase():
    """Debug endpoint to check Supabase connection"""
    debug_info = {
        'supabase_available': SUPABASE_AVAILABLE,
        'supabase_url_set': bool(SUPABASE_URL),
        'supabase_key_set': bool(SUPABASE_KEY),
        'client_exists': supabase_client is not None
    }
    
    if supabase_client:
        try:
            # Try a simple query to test connection
            result = supabase_client.table('users').select('count').limit(1).execute()
            debug_info['connection_test'] = 'success'
            debug_info['tables_accessible'] = True
        except Exception as e:
            debug_info['connection_test'] = 'failed'
            debug_info['error'] = str(e)
            debug_info['tables_accessible'] = False
    else:
        debug_info['connection_test'] = 'not_configured'
        debug_info['reason'] = 'Supabase not initialized'
    
    return jsonify(debug_info)


@app.route('/')
def index():
    """Serve the main page"""
    return send_from_directory('static', 'index.html')


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3006))
    app.run(debug=True, host='0.0.0.0', port=port)

