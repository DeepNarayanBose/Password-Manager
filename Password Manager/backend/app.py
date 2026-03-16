# ============================================
# VaultOne - Flask Backend
# Secure Password Manager API
# Everything in ONE file!
# ============================================

# ===== 1. IMPORTS =====
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import bcrypt
import jwt
import datetime
from functools import wraps
import os
import sys
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import re

# ===== SYSTEM CHECKS ON STARTUP =====
def check_system():
    """Verify system requirements before starting"""
    print("=" * 60)
    print("  VaultOne - System Check")
    print("=" * 60)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ ERROR: Python 3.8 or higher is required")
        print(f"   Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
    
    # Check required packages
    required_packages = {
        'flask': 'Flask',
        'flask_cors': 'Flask-CORS',
        'bcrypt': 'bcrypt',
        'jwt': 'PyJWT',
        'cryptography': 'cryptography'
    }
    
    missing = []
    for package, name in required_packages.items():
        try:
            __import__(package)
        except ImportError:
            missing.append(name)
    
    if missing:
        print(f"❌ ERROR: Missing dependencies: {', '.join(missing)}")
        print("\n📦 Install with:")
        print("   pip install flask flask-cors bcrypt pyjwt cryptography")
        print("   OR")
        print("   pip install -r requirements.txt")
        sys.exit(1)
    print("✅ All dependencies installed")
    
    # Get paths
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(backend_dir)
    frontend_dir = os.path.join(base_dir, 'frontend')
    
    # Check folder structure
    if not os.path.isdir(frontend_dir):
        print(f"❌ ERROR: Frontend folder not found!")
        print(f"   Looking for: {frontend_dir}")
        print(f"\n   Current directory: {os.getcwd()}")
        print(f"   Backend directory: {backend_dir}")
        print(f"   Base directory: {base_dir}")
        print("\n📁 Expected folder structure:")
        print("   password-manager/")
        print("   ├── backend/")
        print("   │   └── app.py  ← You are here")
        print("   └── frontend/")
        print("       ├── index.html")
        print("       └── assets/")
        print("\n💡 Make sure you have both 'backend' and 'frontend' folders in the same parent directory!")
        sys.exit(1)
    print(f"✅ Frontend folder found: {frontend_dir}")
    
    # Check critical files
    index_file = os.path.join(frontend_dir, 'index.html')
    if not os.path.isfile(index_file):
        print(f"❌ ERROR: index.html not found!")
        print(f"   Looking for: {index_file}")
        sys.exit(1)
    print(f"✅ index.html found")
    
    assets_dir = os.path.join(frontend_dir, 'assets')
    if not os.path.isdir(assets_dir):
        print(f"⚠️  WARNING: assets folder not found at {assets_dir}")
    else:
        print(f"✅ Assets folder found")
    
    print("=" * 60)
    print("✅ All system checks passed!")
    print("=" * 60)
    print()
    
    return backend_dir, base_dir, frontend_dir

# Run system checks
BACKEND_DIR, BASE_DIR, FRONTEND_DIR = check_system()

# ===== 2. FLASK CONFIGURATION =====
app = Flask(__name__, 
            static_folder=os.path.join(FRONTEND_DIR, 'assets'),
            static_url_path='/assets')
CORS(app)  # Enable CORS for frontend communication

# Secret key for JWT token generation (In production, use environment variable)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-2024')
app.config['JWT_EXPIRATION_HOURS'] = 24

# Database path - in the database folder at project root
DATABASE_PATH = os.path.join(BASE_DIR, 'database', 'password_manager.db')

# Master encryption key (In production, derive this from environment or user master password)
MASTER_KEY = os.environ.get('MASTER_ENCRYPTION_KEY', 'vault-sys-master-key-2024-change-this')

# Print configuration
print(f"📂 Backend Directory: {BACKEND_DIR}")
print(f"📂 Base Directory: {BASE_DIR}")
print(f"📂 Frontend Directory: {FRONTEND_DIR}")
print(f"📂 Database Path: {DATABASE_PATH}")
print()


# ===== 3. DATABASE CONNECTION FUNCTIONS =====
def get_db_connection():
    """Create and return a database connection"""
    # Ensure database directory exists
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn


def init_database():
    """Initialize the database with required tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    
    # Create Vault table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vault (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            site_name TEXT NOT NULL,
            username TEXT NOT NULL,
            password_encrypted TEXT NOT NULL,
            url TEXT,
            category TEXT DEFAULT 'general',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create index for faster queries
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_vault_user_id ON vault(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully!")
    print()


# ===== 4. PASSWORD HASHING FUNCTIONS =====
def hash_password(password):
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)
    return password_hash.decode('utf-8')


def verify_password(password, password_hash):
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


# ===== 5. ENCRYPTION / DECRYPTION FUNCTIONS =====
def derive_key_from_password(password, salt=None):
    """Derive an encryption key from a password using PBKDF2"""
    if salt is None:
        salt = b'vault-sys-salt-2024'  # In production, use unique salt per user
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode('utf-8')))
    return key


def get_cipher():
    """Get Fernet cipher instance using master key"""
    key = derive_key_from_password(MASTER_KEY)
    return Fernet(key)


def encrypt_password(password):
    """Encrypt a password using Fernet (AES)"""
    cipher = get_cipher()
    encrypted = cipher.encrypt(password.encode('utf-8'))
    return encrypted.decode('utf-8')


def decrypt_password(encrypted_password):
    """Decrypt a password using Fernet (AES)"""
    try:
        cipher = get_cipher()
        decrypted = cipher.decrypt(encrypted_password.encode('utf-8'))
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"Decryption error: {e}")
        return None


# ===== 6. JWT AUTHENTICATION HELPERS =====
def generate_token(user_id, username):
    """Generate JWT token for authenticated user"""
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
        'iat': datetime.datetime.utcnow()
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token


def verify_token(token):
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token expired
    except jwt.InvalidTokenError:
        return None  # Invalid token


def token_required(f):
    """Decorator to protect routes with JWT authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Format: "Bearer <token>"
            except IndexError:
                return jsonify({'success': False, 'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        
        # Verify token
        payload = verify_token(token)
        if not payload:
            return jsonify({'success': False, 'message': 'Token is invalid or expired'}), 401
        
        # Pass user info to the route
        return f(payload, *args, **kwargs)
    
    return decorated


# ===== 7. INPUT VALIDATION =====
def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password_strength(password):
    """Validate password strength (minimum 8 characters)"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    return True, "Password is valid"


def sanitize_input(text):
    """Basic input sanitization"""
    if text is None:
        return None
    # Remove any potentially dangerous characters
    return str(text).strip()


# ===== 8. FRONTEND ROUTES =====

@app.route('/')
def index():
    """Serve the main index page"""
    try:
        return send_from_directory(FRONTEND_DIR, 'index.html')
    except Exception as e:
        return f"Error serving index.html: {str(e)}<br>Looking in: {FRONTEND_DIR}", 500


@app.route('/login')
def login_page():
    """Serve login page"""
    try:
        return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'login.html')
    except Exception as e:
        return f"Error: {str(e)}", 500


@app.route('/register')
def register_page():
    """Serve register page"""
    try:
        return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'register.html')
    except Exception as e:
        return f"Error: {str(e)}", 500


@app.route('/vault')
def vault_page():
    """Serve vault page"""
    try:
        return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'vault.html')
    except Exception as e:
        return f"Error: {str(e)}", 500


@app.route('/add')
def add_page():
    """Serve add entry page"""
    try:
        return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'add.html')
    except Exception as e:
        return f"Error: {str(e)}", 500


@app.route('/edit')
def edit_page():
    """Serve edit entry page"""
    try:
        return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'edit.html')
    except Exception as e:
        return f"Error: {str(e)}", 500


@app.route('/settings')
def settings_page():
    """Serve settings page"""
    try:
        return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'settings.html')
    except Exception as e:
        return f"Error: {str(e)}", 500


# ===== 9. API ENDPOINTS =====

@app.route('/api/health', methods=['GET'])
def health_check():
    """Check if API is running"""
    return jsonify({
        'success': True,
        'message': 'VaultOne API is operational',
        'version': '1.0.0'
    }), 200


@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('email') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        username = sanitize_input(data['username'])
        email = sanitize_input(data['email'])
        password = data['password']
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        
        # Validate password strength
        is_valid, message = validate_password_strength(password)
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400
        
        # Hash password
        password_hash = hash_password(password)
        
        # Insert into database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                (username, email, password_hash)
            )
            conn.commit()
            user_id = cursor.lastrowid
            
            return jsonify({
                'success': True,
                'message': 'User registered successfully',
                'user_id': user_id
            }), 201
            
        except sqlite3.IntegrityError:
            return jsonify({'success': False, 'message': 'Username or email already exists'}), 409
        
        finally:
            conn.close()
    
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Missing username or password'}), 400
        
        username = sanitize_input(data['username'])
        password = data['password']
        
        # Get user from database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
        
        # Verify password
        if not verify_password(password, user['password_hash']):
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
        
        # Update last login
        cursor.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            (user['id'],)
        )
        conn.commit()
        conn.close()
        
        # Generate JWT token
        token = generate_token(user['id'], user['username'])
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email']
            }
        }), 200
    
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/vault', methods=['GET'])
@token_required
def get_vault(current_user):
    """Get all password entries for the authenticated user"""
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT * FROM vault WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)
        )
        entries = cursor.fetchall()
        conn.close()
        
        # Decrypt passwords and format response
        vault_entries = []
        for entry in entries:
            decrypted_password = decrypt_password(entry['password_encrypted'])
            
            vault_entries.append({
                'id': entry['id'],
                'siteName': entry['site_name'],
                'username': entry['username'],
                'password': decrypted_password,
                'url': entry['url'],
                'category': entry['category'],
                'notes': entry['notes'],
                'createdAt': entry['created_at'],
                'updatedAt': entry['updated_at']
            })
        
        return jsonify({
            'success': True,
            'entries': vault_entries,
            'count': len(vault_entries)
        }), 200
    
    except Exception as e:
        print(f"Vault retrieval error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/add', methods=['POST'])
@token_required
def add_entry(current_user):
    """Add a new password entry to the vault"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        
        # Validate input
        if not data or not data.get('siteName') or not data.get('username') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        site_name = sanitize_input(data['siteName'])
        username = sanitize_input(data['username'])
        password = data['password']
        url = sanitize_input(data.get('url', ''))
        category = sanitize_input(data.get('category', 'general'))
        notes = sanitize_input(data.get('notes', ''))
        
        # Encrypt password
        encrypted_password = encrypt_password(password)
        
        # Insert into database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO vault (user_id, site_name, username, password_encrypted, url, category, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, site_name, username, encrypted_password, url, category, notes))
        
        conn.commit()
        entry_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Password entry added successfully',
            'entry_id': entry_id
        }), 201
    
    except Exception as e:
        print(f"Add entry error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/edit/<int:entry_id>', methods=['PUT'])
@token_required
def edit_entry(current_user, entry_id):
    """Update an existing password entry"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        
        # Validate input
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Get existing entry to verify ownership
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM vault WHERE id = ? AND user_id = ?', (entry_id, user_id))
        entry = cursor.fetchone()
        
        if not entry:
            conn.close()
            return jsonify({'success': False, 'message': 'Entry not found or unauthorized'}), 404
        
        # Prepare update fields
        site_name = sanitize_input(data.get('siteName', entry['site_name']))
        username = sanitize_input(data.get('username', entry['username']))
        url = sanitize_input(data.get('url', entry['url']))
        category = sanitize_input(data.get('category', entry['category']))
        notes = sanitize_input(data.get('notes', entry['notes']))
        
        # Encrypt password if provided
        if 'password' in data and data['password']:
            encrypted_password = encrypt_password(data['password'])
        else:
            encrypted_password = entry['password_encrypted']
        
        # Update database
        cursor.execute('''
            UPDATE vault 
            SET site_name = ?, username = ?, password_encrypted = ?, url = ?, 
                category = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        ''', (site_name, username, encrypted_password, url, category, notes, entry_id, user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Password entry updated successfully'
        }), 200
    
    except Exception as e:
        print(f"Edit entry error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/delete/<int:entry_id>', methods=['DELETE'])
@token_required
def delete_entry(current_user, entry_id):
    """Delete a password entry"""
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify ownership before deleting
        cursor.execute('SELECT * FROM vault WHERE id = ? AND user_id = ?', (entry_id, user_id))
        entry = cursor.fetchone()
        
        if not entry:
            conn.close()
            return jsonify({'success': False, 'message': 'Entry not found or unauthorized'}), 404
        
        # Delete entry
        cursor.execute('DELETE FROM vault WHERE id = ? AND user_id = ?', (entry_id, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Password entry deleted successfully'
        }), 200
    
    except Exception as e:
        print(f"Delete entry error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    """Get current user profile"""
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, username, email, created_at, last_login FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        
        # Get vault statistics
        cursor.execute('SELECT COUNT(*) as count FROM vault WHERE user_id = ?', (user_id,))
        vault_count = cursor.fetchone()['count']
        
        conn.close()
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'createdAt': user['created_at'],
                'lastLogin': user['last_login'],
                'vaultEntries': vault_count
            }
        }), 200
    
    except Exception as e:
        print(f"Profile retrieval error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/update-email', methods=['PUT'])
@token_required
def update_email(current_user):
    """Update user email"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        
        if not data or not data.get('email'):
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        
        email = sanitize_input(data['email'])
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('UPDATE users SET email = ? WHERE id = ?', (email, user_id))
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'message': 'Email updated successfully'
            }), 200
        
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'success': False, 'message': 'Email already in use'}), 409
    
    except Exception as e:
        print(f"Update email error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/change-password', methods=['PUT'])
@token_required
def change_password(current_user):
    """Change user master password"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        
        if not data or not data.get('currentPassword') or not data.get('newPassword'):
            return jsonify({'success': False, 'message': 'Current and new password are required'}), 400
        
        current_password = data['currentPassword']
        new_password = data['newPassword']
        
        # Validate new password strength
        is_valid, message = validate_password_strength(new_password)
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current password hash
        cursor.execute('SELECT password_hash FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Verify current password
        if not verify_password(current_password, user['password_hash']):
            conn.close()
            return jsonify({'success': False, 'message': 'Current password is incorrect'}), 401
        
        # Hash new password
        new_password_hash = hash_password(new_password)
        
        # Update password
        cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_password_hash, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Password changed successfully'
        }), 200
    
    except Exception as e:
        print(f"Change password error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/clear-vault', methods=['DELETE'])
@token_required
def clear_vault(current_user):
    """Delete all vault entries for the user"""
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM vault WHERE user_id = ?', (user_id,))
        deleted_count = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Vault cleared successfully. {deleted_count} entries deleted.'
        }), 200
    
    except Exception as e:
        print(f"Clear vault error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/delete-account', methods=['DELETE'])
@token_required
def delete_account(current_user):
    """Delete user account and all associated data"""
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Delete all vault entries first
        cursor.execute('DELETE FROM vault WHERE user_id = ?', (user_id,))
        
        # Delete user account
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        }), 200
    
    except Exception as e:
        print(f"Delete account error: {e}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Endpoint not found'}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'success': False, 'message': 'Method not allowed'}), 405


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ===== 10. RUN THE FLASK APP =====
if __name__ == '__main__':
    # Initialize database on startup
    init_database()
    
    # Run the Flask application
    print("=" * 60)
    print("  VaultOne Password Manager")
    print("=" * 60)
    print()
    print("🚀 Server starting...")
    print(f"🌐 Access the application at: http://localhost:5000")
    print(f"📡 API endpoint: http://localhost:5000/api/health")
    print()
    print("=" * 60)
    print("Press CTRL+C to stop the server")
    print("=" * 60)
    print()
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True  # Set to False in production
    )