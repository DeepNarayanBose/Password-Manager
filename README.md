# VAULT_SYS - Secure Password Manager

A modern, secure password manager with a hacker-themed terminal interface. Features end-to-end encryption, JWT authentication, and a Flask-powered backend.

## 🔐 Security Features

- **AES-256 Encryption**: All passwords are encrypted using Fernet (AES)
- **Bcrypt Hashing**: Master passwords are hashed with bcrypt
- **JWT Authentication**: Secure token-based authentication
- **SQL Injection Protection**: Parameterized queries throughout
- **Input Validation**: All inputs are sanitized and validated
- **HTTPS Ready**: Designed for secure deployment

## 📁 Project Structure

```
password-manager/
│
├── frontend/
│   ├── index.html              # Landing page
│   ├── pages/
│   │   ├── login.html          # User login
│   │   ├── register.html       # User registration
│   │   ├── vault.html          # Password vault
│   │   ├── add.html            # Add password
│   │   ├── edit.html           # Edit password
│   │   └── settings.html       # User settings
│   │
│   └── assets/
│       ├── style.css           # Hacker-themed styles
│       └── app.js              # Frontend logic
│
├── backend/
│   ├── app.py                  # Flask API server
│   └── requirements.txt        # Python dependencies
│
├── database/
│   └── password_manager.db     # SQLite database (auto-created)
│
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Modern web browser

### Installation

1. **Clone or download the project**

2. **Install Python dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Start the backend server**
   ```bash
   python app.py
   ```
   
   The API will start on `http://localhost:5000`

4. **Open the frontend**
   - Open `frontend/index.html` in your web browser
   - Or use a local web server:
     ```bash
     cd frontend
     python -m http.server 8080
     ```
   - Then navigate to `http://localhost:8080`

## 🔧 Configuration

### Environment Variables (Optional)

For production, set these environment variables:

```bash
export SECRET_KEY="your-super-secret-jwt-key"
export MASTER_ENCRYPTION_KEY="your-encryption-master-key"
```

### Backend Configuration

Edit `backend/app.py` to modify:
- JWT token expiration time (default: 24 hours)
- Server host and port (default: localhost:5000)
- Database location

## 📡 API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login and get JWT token |
| GET | `/health` | API health check |

### Protected Endpoints (Require JWT Token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vault` | Get all password entries |
| POST | `/add` | Add new password entry |
| PUT | `/edit/<id>` | Update password entry |
| DELETE | `/delete/<id>` | Delete password entry |
| GET | `/profile` | Get user profile |
| PUT | `/update-email` | Update user email |
| PUT | `/change-password` | Change master password |
| DELETE | `/clear-vault` | Delete all entries |
| DELETE | `/delete-account` | Delete user account |

### Authentication

Protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📝 API Usage Examples

### Register User

```bash
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "hacker",
    "email": "hacker@example.com",
    "password": "SecurePass123"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "hacker",
    "password": "SecurePass123"
  }'
```

### Add Password Entry

```bash
curl -X POST http://localhost:5000/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "siteName": "GitHub",
    "username": "myusername",
    "password": "MyGitHubPass123",
    "url": "https://github.com",
    "category": "work",
    "notes": "Work account"
  }'
```

### Get All Vault Entries

```bash
curl -X GET http://localhost:5000/vault \
  -H "Authorization: Bearer <your-token>"
```

## 🗄️ Database Schema

### Users Table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### Vault Table

```sql
CREATE TABLE vault (
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
);
```

## 🎨 Frontend Features

- **Hacker Terminal Theme**: Matrix-inspired green-on-black design
- **Password Generator**: Create strong random passwords
- **Password Strength Indicator**: Real-time password strength feedback
- **Search & Filter**: Quickly find saved passwords
- **Categories**: Organize passwords by type
- **Responsive Design**: Works on desktop and mobile

## 🔒 Security Best Practices

### For Users

1. Use a strong, unique master password
2. Enable 2FA (when available)
3. Regularly update your passwords
4. Don't share your master password
5. Keep your vault backed up

### For Developers

1. **Never commit sensitive keys** to version control
2. Use environment variables for secrets in production
3. Enable HTTPS in production
4. Implement rate limiting on login endpoints
5. Regular security audits
6. Keep dependencies updated

## 🚨 Important Security Notes

- **Master Password**: Cannot be recovered if lost
- **Encryption Key**: Store securely; changing it invalidates all stored passwords
- **JWT Secret**: Change in production environment
- **Database**: Backup regularly
- **HTTPS**: Always use HTTPS in production

## 🐛 Troubleshooting

### Database Issues

If you encounter database errors:
```bash
# Delete the database and restart
rm database/password_manager.db
python backend/app.py
```

### CORS Errors

If frontend can't connect to backend:
1. Ensure backend is running on port 5000
2. Check browser console for errors
3. Verify CORS is enabled in `app.py`

### Token Expired

If you get "Token expired" errors:
- Login again to get a new token
- Token validity: 24 hours (configurable)

## 📦 Deployment

### Production Checklist

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Change `MASTER_ENCRYPTION_KEY` to a strong random value
- [ ] Set `debug=False` in app.py
- [ ] Use a production WSGI server (gunicorn, uWSGI)
- [ ] Set up HTTPS with SSL certificate
- [ ] Implement rate limiting
- [ ] Set up automated backups
- [ ] Use environment variables for secrets
- [ ] Configure firewall rules
- [ ] Set up logging and monitoring

### Example Production Deployment

```bash
# Install production server
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 🤝 Contributing

This is a demonstration project. For production use:
1. Add comprehensive testing
2. Implement rate limiting
3. Add 2FA support
4. Enhance logging
5. Add backup/restore features

## 📄 License

This project is for educational purposes.

## ⚠️ Disclaimer

This is a demonstration password manager. While it implements real security measures, for critical production use, consider established solutions like:
- Bitwarden
- 1Password
- KeePass

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check browser console for errors
4. Verify backend logs

## 🎯 Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Password sharing (encrypted)
- [ ] Browser extensions
- [ ] Mobile apps
- [ ] Biometric authentication
- [ ] Password breach checking
- [ ] Auto-fill functionality
- [ ] Import/export features
- [ ] Session management
- [ ] Account recovery options

---

**Built with 🔐 by VAULT_SYS Team**

*Remember: Your security is only as strong as your master password!*
