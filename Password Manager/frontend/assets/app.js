// ============================================
// VAULT_SYS - Main Application JavaScript
// ============================================

// ===== API Configuration =====
const API_BASE_URL = window.location.origin; // Use same origin as the page
const API_ENDPOINTS = {
    register: `${API_BASE_URL}/api/register`,
    login: `${API_BASE_URL}/api/login`,
    vault: `${API_BASE_URL}/api/vault`,
    add: `${API_BASE_URL}/api/add`,
    edit: (id) => `${API_BASE_URL}/api/edit/${id}`,
    delete: (id) => `${API_BASE_URL}/api/delete/${id}`,
    profile: `${API_BASE_URL}/api/profile`,
    updateEmail: `${API_BASE_URL}/api/update-email`,
    changePassword: `${API_BASE_URL}/api/change-password`,
    clearVault: `${API_BASE_URL}/api/clear-vault`,
    deleteAccount: `${API_BASE_URL}/api/delete-account`
};

// ===== Utility Functions =====
const VaultUtils = {
    // Generate random ID
    generateId: () => {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Format date
    formatDate: (date) => {
        return new Date(date).toLocaleString();
    },

    // Copy to clipboard
    copyToClipboard: (text) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return Promise.resolve();
        }
    },

    // Show status message
    showStatus: (elementId, message, type = 'success') => {
        const statusEl = document.getElementById(elementId);
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status-message ${type}`;
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }
};

// ===== Password Generator =====
const PasswordGenerator = {
    generate: (length = 16, options = {}) => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        let chars = '';
        if (options.uppercase !== false) chars += uppercase;
        if (options.lowercase !== false) chars += lowercase;
        if (options.numbers !== false) chars += numbers;
        if (options.symbols !== false) chars += symbols;

        if (chars === '') chars = lowercase; // Default to lowercase if nothing selected

        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    },

    checkStrength: (password) => {
        let strength = 0;
        if (!password) return { score: 0, text: 'UNKNOWN', class: '' };

        // Length check
        if (password.length >= 8) strength += 1;
        if (password.length >= 12) strength += 1;
        if (password.length >= 16) strength += 1;

        // Character variety
        if (/[a-z]/.test(password)) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 1;

        if (strength <= 2) return { score: 25, text: 'WEAK', class: 'weak' };
        if (strength <= 4) return { score: 50, text: 'MEDIUM', class: 'medium' };
        if (strength <= 6) return { score: 75, text: 'STRONG', class: 'strong' };
        return { score: 100, text: 'VERY STRONG', class: 'very-strong' };
    }
};

// ===== Storage Manager (LocalStorage) =====
const StorageManager = {
    // Save data
    save: (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },

    // Load data
    load: (key) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage error:', e);
            return null;
        }
    },

    // Remove data
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },

    // Clear all data
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }
};

// ===== Authentication Manager =====
const AuthManager = {
    currentUser: null,
    token: null,

    // Register new user
    register: async (username, email, password) => {
        try {
            const response = await fetch(API_ENDPOINTS.register, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message || 'Registration failed' };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    // Login user
    login: async (username, password) => {
        try {
            const response = await fetch(API_ENDPOINTS.login, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                // Store token and user info
                AuthManager.token = data.token;
                AuthManager.currentUser = data.user.username;
                StorageManager.save('authToken', data.token);
                StorageManager.save('currentUser', data.user);
                return { success: true, message: data.message, user: data.user };
            } else {
                return { success: false, message: data.message || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    // Logout user
    logout: () => {
        AuthManager.currentUser = null;
        AuthManager.token = null;
        StorageManager.remove('authToken');
        StorageManager.remove('currentUser');
    },

    // Check if user is logged in
    isLoggedIn: () => {
        if (!AuthManager.token) {
            AuthManager.token = StorageManager.load('authToken');
        }
        return !!AuthManager.token;
    },

    // Get current user
    getCurrentUser: () => {
        if (!AuthManager.currentUser) {
            const user = StorageManager.load('currentUser');
            AuthManager.currentUser = user ? user.username : null;
        }
        return AuthManager.currentUser;
    },

    // Get auth token
    getToken: () => {
        if (!AuthManager.token) {
            AuthManager.token = StorageManager.load('authToken');
        }
        return AuthManager.token;
    },

    // Get auth headers
    getAuthHeaders: () => {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AuthManager.getToken()}`
        };
    },

    // Require authentication (redirect if not logged in)
    requireAuth: () => {
        if (!AuthManager.isLoggedIn()) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }
};

// ===== Vault Manager =====
const VaultManager = {
    // Get vault entries for current user
    getEntries: async () => {
        try {
            const response = await fetch(API_ENDPOINTS.vault, {
                headers: AuthManager.getAuthHeaders()
            });

            if (response.status === 401) {
                AuthManager.logout();
                window.location.href = '/login';
                return [];
            }

            const data = await response.json();
            
            if (data.success) {
                return data.entries;
            } else {
                console.error('Failed to fetch entries:', data.message);
                return [];
            }
        } catch (error) {
            console.error('Error fetching vault:', error);
            return [];
        }
    },

    // Save vault entries (not used with backend, kept for compatibility)
    saveEntries: (entries) => {
        console.warn('saveEntries is deprecated with backend API');
        return false;
    },

    // Add new entry
    addEntry: async (entry) => {
        try {
            const response = await fetch(API_ENDPOINTS.add, {
                method: 'POST',
                headers: AuthManager.getAuthHeaders(),
                body: JSON.stringify(entry)
            });

            const data = await response.json();
            
            if (response.ok) {
                return true;
            } else {
                console.error('Failed to add entry:', data.message);
                return false;
            }
        } catch (error) {
            console.error('Error adding entry:', error);
            return false;
        }
    },

    // Update entry
    updateEntry: async (id, updatedEntry) => {
        try {
            const response = await fetch(API_ENDPOINTS.edit(id), {
                method: 'PUT',
                headers: AuthManager.getAuthHeaders(),
                body: JSON.stringify(updatedEntry)
            });

            const data = await response.json();
            
            if (response.ok) {
                return true;
            } else {
                console.error('Failed to update entry:', data.message);
                return false;
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            return false;
        }
    },

    // Delete entry
    deleteEntry: async (id) => {
        try {
            const response = await fetch(API_ENDPOINTS.delete(id), {
                method: 'DELETE',
                headers: AuthManager.getAuthHeaders()
            });

            const data = await response.json();
            
            if (response.ok) {
                return true;
            } else {
                console.error('Failed to delete entry:', data.message);
                return false;
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            return false;
        }
    },

    // Get entry by ID (from cached entries or fetch)
    getEntryById: async (id) => {
        const entries = await VaultManager.getEntries();
        return entries.find(e => e.id == id);
    },

    // Search entries
    searchEntries: async (query) => {
        const entries = await VaultManager.getEntries();
        const lowerQuery = query.toLowerCase();
        return entries.filter(e => 
            e.siteName.toLowerCase().includes(lowerQuery) ||
            e.username.toLowerCase().includes(lowerQuery) ||
            (e.category && e.category.toLowerCase().includes(lowerQuery))
        );
    },

    // Clear all entries
    clearVault: async () => {
        try {
            const response = await fetch(API_ENDPOINTS.clearVault, {
                method: 'DELETE',
                headers: AuthManager.getAuthHeaders()
            });

            const data = await response.json();
            return response.ok;
        } catch (error) {
            console.error('Error clearing vault:', error);
            return false;
        }
    }
};

// ===== Page-Specific Handlers =====

// Login Page
if (document.getElementById('loginForm')) {
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const result = await AuthManager.login(username, password);
        
        if (result.success) {
            VaultUtils.showStatus('loginStatus', result.message, 'success');
            setTimeout(() => {
                window.location.href = '/vault';
            }, 1000);
        } else {
            VaultUtils.showStatus('loginStatus', result.message, 'error');
        }
    });
}

// Register Page
if (document.getElementById('registerForm')) {
    const registerForm = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');

    // Password strength checker
    passwordInput.addEventListener('input', () => {
        const strength = PasswordGenerator.checkStrength(passwordInput.value);
        strengthFill.style.width = strength.score + '%';
        strengthFill.className = 'strength-fill ' + strength.class;
        strengthText.querySelector('span').textContent = strength.text;
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            VaultUtils.showStatus('registerStatus', 'Passwords do not match', 'error');
            return;
        }

        if (password.length < 8) {
            VaultUtils.showStatus('registerStatus', 'Password must be at least 8 characters', 'error');
            return;
        }
        
        const result = await AuthManager.register(username, email, password);
        
        if (result.success) {
            VaultUtils.showStatus('registerStatus', result.message, 'success');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
        } else {
            VaultUtils.showStatus('registerStatus', result.message, 'error');
        }
    });
}

// Vault Page
if (document.getElementById('vaultEntries')) {
    // Check authentication
    if (!AuthManager.requireAuth()) {
        // Will redirect
    } else {
        const currentUser = AuthManager.getCurrentUser();
        document.getElementById('currentUser').textContent = currentUser;

        // Load and display entries
        async function loadEntries(entries = null) {
            const vaultEntries = entries || await VaultManager.getEntries();
            const container = document.getElementById('vaultEntries');
            const emptyState = document.getElementById('emptyVault');
            
            document.getElementById('totalEntries').textContent = vaultEntries.length;
            document.getElementById('entriesCount').textContent = vaultEntries.length;
            
            if (vaultEntries.length === 0) {
                container.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }
            
            container.style.display = 'grid';
            emptyState.style.display = 'none';
            
            container.innerHTML = vaultEntries.map(entry => `
                <div class="vault-entry">
                    <div class="entry-header">
                        <h3 class="entry-title">${entry.siteName}</h3>
                        <span class="entry-category">${entry.category || 'general'}</span>
                    </div>
                    <div class="entry-info">
                        <span class="entry-label">Username:</span>
                        <div class="entry-value">${entry.username}</div>
                    </div>
                    ${entry.url ? `
                    <div class="entry-info">
                        <span class="entry-label">URL:</span>
                        <div class="entry-value">${entry.url}</div>
                    </div>
                    ` : ''}
                    <div class="entry-actions">
                        <button class="btn btn-small btn-primary" onclick="viewEntry('${entry.id}')">
                            <span class="btn-icon">👁</span> VIEW
                        </button>
                        <a href="/edit?id=${entry.id}" class="btn btn-small btn-secondary">
                            <span class="btn-icon">✏</span> EDIT
                        </a>
                    </div>
                </div>
            `).join('');
        }

        loadEntries();

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value;
            if (query.trim() === '') {
                await loadEntries();
            } else {
                const results = await VaultManager.searchEntries(query);
                await loadEntries(results);
            }
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                AuthManager.logout();
                window.location.href = '/';
            }
        });

        // Update last access time
        const now = new Date();
        document.getElementById('lastAccess').textContent = now.toLocaleTimeString();
    }
}

// View Entry Modal (on vault page)
async function viewEntry(id) {
    const entry = await VaultManager.getEntryById(id);
    if (!entry) return;

    const modal = document.getElementById('viewModal');
    document.getElementById('modalSite').textContent = entry.siteName;
    document.getElementById('modalUsername').textContent = entry.username;
    document.getElementById('modalPassword').textContent = entry.password;
    document.getElementById('modalUrl').textContent = entry.url || 'N/A';
    document.getElementById('modalNotes').textContent = entry.notes || 'No notes';

    modal.classList.add('active');

    // Toggle password visibility
    const toggleBtn = document.getElementById('togglePassword');
    const passwordEl = document.getElementById('modalPassword');
    let isVisible = false;

    toggleBtn.onclick = () => {
        isVisible = !isVisible;
        if (isVisible) {
            passwordEl.textContent = entry.password;
            passwordEl.classList.remove('password-hidden');
            toggleBtn.innerHTML = '<span class="btn-icon">🙈</span> HIDE';
        } else {
            passwordEl.textContent = '••••••••••••';
            passwordEl.classList.add('password-hidden');
            toggleBtn.innerHTML = '<span class="btn-icon">👁</span> REVEAL';
        }
    };

    // Copy password
    document.getElementById('copyPasswordBtn').onclick = () => {
        VaultUtils.copyToClipboard(entry.password).then(() => {
            alert('Password copied to clipboard!');
        });
    };

    // Close modal
    const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
    closeButtons.forEach(btn => {
        btn.onclick = () => {
            modal.classList.remove('active');
            passwordEl.textContent = '••••••••••••';
            passwordEl.classList.add('password-hidden');
            toggleBtn.innerHTML = '<span class="btn-icon">👁</span> REVEAL';
        };
    });
}

// Add Entry Page
if (document.getElementById('addEntryForm')) {
    if (!AuthManager.requireAuth()) {
        // Will redirect
    } else {
        const addForm = document.getElementById('addEntryForm');
        const passwordInput = document.getElementById('password');
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');

        // Password strength checker
        passwordInput.addEventListener('input', () => {
            const strength = PasswordGenerator.checkStrength(passwordInput.value);
            strengthFill.style.width = strength.score + '%';
            strengthFill.className = 'strength-fill ' + strength.class;
            strengthText.querySelector('span').textContent = strength.text;
        });

        // Toggle password visibility
        document.getElementById('togglePasswordVisibility').addEventListener('click', () => {
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        });

        // Password generator
        const generatorModal = document.getElementById('generatorModal');
        document.getElementById('generatePassword').addEventListener('click', () => {
            generatorModal.classList.add('active');
            generateNewPassword();
        });

        function generateNewPassword() {
            const length = document.getElementById('passwordLength').value;
            const options = {
                uppercase: document.getElementById('includeUppercase').checked,
                lowercase: document.getElementById('includeLowercase').checked,
                numbers: document.getElementById('includeNumbers').checked,
                symbols: document.getElementById('includeSymbols').checked
            };
            const password = PasswordGenerator.generate(parseInt(length), options);
            document.getElementById('generatedPassword').value = password;
        }

        document.getElementById('passwordLength').addEventListener('input', (e) => {
            document.getElementById('lengthValue').textContent = e.target.value;
            generateNewPassword();
        });

        ['includeUppercase', 'includeLowercase', 'includeNumbers', 'includeSymbols'].forEach(id => {
            document.getElementById(id).addEventListener('change', generateNewPassword);
        });

        document.getElementById('regenerateBtn').addEventListener('click', generateNewPassword);

        document.getElementById('usePasswordBtn').addEventListener('click', () => {
            const generatedPassword = document.getElementById('generatedPassword').value;
            passwordInput.value = generatedPassword;
            passwordInput.dispatchEvent(new Event('input'));
            generatorModal.classList.remove('active');
        });

        // Close generator modal
        generatorModal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                generatorModal.classList.remove('active');
            });
        });

        // Submit form
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const entry = {
                siteName: document.getElementById('siteName').value,
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                url: document.getElementById('url').value,
                category: document.getElementById('category').value,
                notes: document.getElementById('notes').value
            };

            if (await VaultManager.addEntry(entry)) {
                VaultUtils.showStatus('addStatus', 'Entry added successfully!', 'success');
                setTimeout(() => {
                    window.location.href = '/vault';
                }, 1000);
            } else {
                VaultUtils.showStatus('addStatus', 'Failed to add entry', 'error');
            }
        });
    }
}

// Edit Entry Page
if (document.getElementById('editEntryForm')) {
    if (!AuthManager.requireAuth()) {
        // Will redirect
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const entryId = urlParams.get('id');

        if (!entryId) {
            window.location.href = '/vault';
        } else {
            // Load entry data
            (async () => {
                const entry = await VaultManager.getEntryById(entryId);
                
                if (!entry) {
                    alert('Entry not found');
                    window.location.href = '/vault';
                    return;
                }
                
                // Populate form
                document.getElementById('entryId').value = entry.id;
                document.getElementById('siteName').value = entry.siteName;
                document.getElementById('username').value = entry.username;
                document.getElementById('password').value = entry.password;
                document.getElementById('url').value = entry.url || '';
                document.getElementById('category').value = entry.category || 'general';
                document.getElementById('notes').value = entry.notes || '';

                document.getElementById('entryIdDisplay').textContent = String(entry.id).substr(-8);
                document.getElementById('entryIdFooter').textContent = String(entry.id).substr(-8);
                document.getElementById('lastModified').textContent = VaultUtils.formatDate(entry.updatedAt);

                const passwordInput = document.getElementById('password');
                const strengthFill = document.getElementById('strengthFill');
                const strengthText = document.getElementById('strengthText');

                // Initial strength check
                const initialStrength = PasswordGenerator.checkStrength(passwordInput.value);
                strengthFill.style.width = initialStrength.score + '%';
                strengthFill.className = 'strength-fill ' + initialStrength.class;
                strengthText.querySelector('span').textContent = initialStrength.text;

                // Password strength checker
                passwordInput.addEventListener('input', () => {
                    const strength = PasswordGenerator.checkStrength(passwordInput.value);
                    strengthFill.style.width = strength.score + '%';
                    strengthFill.className = 'strength-fill ' + strength.class;
                    strengthText.querySelector('span').textContent = strength.text;
                });

                // Toggle password visibility
                document.getElementById('togglePasswordVisibility').addEventListener('click', () => {
                    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
                });

                // Password generator (same as add page)
                const generatorModal = document.getElementById('generatorModal');
                document.getElementById('generatePassword').addEventListener('click', () => {
                    generatorModal.classList.add('active');
                    generateNewPassword();
                });

                function generateNewPassword() {
                    const length = document.getElementById('passwordLength').value;
                    const options = {
                        uppercase: document.getElementById('includeUppercase').checked,
                        lowercase: document.getElementById('includeLowercase').checked,
                        numbers: document.getElementById('includeNumbers').checked,
                        symbols: document.getElementById('includeSymbols').checked
                    };
                    const password = PasswordGenerator.generate(parseInt(length), options);
                    document.getElementById('generatedPassword').value = password;
                }

                document.getElementById('passwordLength').addEventListener('input', (e) => {
                    document.getElementById('lengthValue').textContent = e.target.value;
                    generateNewPassword();
                });

                ['includeUppercase', 'includeLowercase', 'includeNumbers', 'includeSymbols'].forEach(id => {
                    document.getElementById(id).addEventListener('change', generateNewPassword);
                });

                document.getElementById('regenerateBtn').addEventListener('click', generateNewPassword);

                document.getElementById('usePasswordBtn').addEventListener('click', () => {
                    const generatedPassword = document.getElementById('generatedPassword').value;
                    passwordInput.value = generatedPassword;
                    passwordInput.dispatchEvent(new Event('input'));
                    generatorModal.classList.remove('active');
                });

                generatorModal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        generatorModal.classList.remove('active');
                    });
                });

                // Submit form
                document.getElementById('editEntryForm').addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const updatedEntry = {
                        siteName: document.getElementById('siteName').value,
                        username: document.getElementById('username').value,
                        password: document.getElementById('password').value,
                        url: document.getElementById('url').value,
                        category: document.getElementById('category').value,
                        notes: document.getElementById('notes').value
                    };

                    if (await VaultManager.updateEntry(entryId, updatedEntry)) {
                        VaultUtils.showStatus('editStatus', 'Entry updated successfully!', 'success');
                        setTimeout(() => {
                            window.location.href = '/vault';
                        }, 1000);
                    } else {
                        VaultUtils.showStatus('editStatus', 'Failed to update entry', 'error');
                    }
                });

                // Delete entry
                const deleteModal = document.getElementById('deleteModal');
                document.getElementById('deleteEntry').addEventListener('click', () => {
                    document.getElementById('deleteEntryName').textContent = entry.siteName;
                    deleteModal.classList.add('active');
                });

                document.getElementById('confirmDelete').addEventListener('click', async () => {
                    if (await VaultManager.deleteEntry(entryId)) {
                        alert('Entry deleted successfully!');
                        window.location.href = '/vault';
                    } else {
                        alert('Failed to delete entry');
                    }
                });

                deleteModal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        deleteModal.classList.remove('active');
                    });
                });
            })();
        }
    }
}

// Settings Page
if (document.getElementById('saveSettings')) {
    if (!AuthManager.requireAuth()) {
        // Will redirect
    } else {
        // Load user info from API
        (async () => {
            try {
                const response = await fetch(API_ENDPOINTS.profile, {
                    headers: AuthManager.getAuthHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const user = data.user;
                    
                    document.getElementById('displayUsername').textContent = user.username;
                    document.getElementById('displayEmail').textContent = user.email;
                    document.getElementById('totalEntries').textContent = user.vaultEntries;
                    document.getElementById('vaultCreated').textContent = VaultUtils.formatDate(user.createdAt);
                } else {
                    console.error('Failed to load profile');
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            }
        })();

        // Save settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            VaultUtils.showStatus('settingsStatus', 'Settings saved successfully!', 'success');
        });

        // Change master password
        const changeMasterPasswordModal = document.getElementById('changeMasterPasswordModal');
        document.getElementById('changeMasterPassword').addEventListener('click', () => {
            changeMasterPasswordModal.classList.add('active');
        });

        document.getElementById('changeMasterPasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                alert('New passwords do not match');
                return;
            }

            if (newPassword.length < 8) {
                alert('Password must be at least 8 characters');
                return;
            }

            try {
                const response = await fetch(API_ENDPOINTS.changePassword, {
                    method: 'PUT',
                    headers: AuthManager.getAuthHeaders(),
                    body: JSON.stringify({
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    })
                });

                const data = await response.json();
                
                if (response.ok) {
                    alert('Master password updated successfully!');
                    changeMasterPasswordModal.classList.remove('active');
                    document.getElementById('changeMasterPasswordForm').reset();
                } else {
                    alert(data.message || 'Failed to update password');
                }
            } catch (error) {
                console.error('Error changing password:', error);
                alert('Network error. Please try again.');
            }
        });

        changeMasterPasswordModal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                changeMasterPasswordModal.classList.remove('active');
            });
        });

        // Clear vault
        const clearVaultModal = document.getElementById('clearVaultModal');
        document.getElementById('clearVault').addEventListener('click', () => {
            clearVaultModal.classList.add('active');
        });

        document.getElementById('confirmClearVault').addEventListener('click', async () => {
            const confirmText = document.getElementById('clearVaultConfirm').value;
            if (confirmText === 'DELETE ALL') {
                if (await VaultManager.clearVault()) {
                    alert('Vault cleared successfully!');
                    clearVaultModal.classList.remove('active');
                    window.location.reload();
                } else {
                    alert('Failed to clear vault');
                }
            } else {
                alert('Please type DELETE ALL to confirm');
            }
        });

        clearVaultModal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                clearVaultModal.classList.remove('active');
                document.getElementById('clearVaultConfirm').value = '';
            });
        });

        // Export vault (not implemented yet with backend)
        document.getElementById('exportVault').addEventListener('click', async () => {
            const entries = await VaultManager.getEntries();
            const dataStr = JSON.stringify(entries, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vault_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        });

        // Delete account
        document.getElementById('deleteAccount').addEventListener('click', async () => {
            if (confirm('Are you ABSOLUTELY SURE you want to delete your account? This cannot be undone!')) {
                if (confirm('This will permanently delete all your data. Click OK to confirm.')) {
                    try {
                        const response = await fetch(API_ENDPOINTS.deleteAccount, {
                            method: 'DELETE',
                            headers: AuthManager.getAuthHeaders()
                        });

                        if (response.ok) {
                            AuthManager.logout();
                            alert('Account deleted successfully');
                            window.location.href = '/';
                        } else {
                            alert('Failed to delete account');
                        }
                    } catch (error) {
                        console.error('Error deleting account:', error);
                        alert('Network error. Please try again.');
                    }
                }
            }
        });
    }
}

// ===== Global Error Handler =====
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
});

// ===== Initialize =====
console.log('VAULT_SYS initialized');