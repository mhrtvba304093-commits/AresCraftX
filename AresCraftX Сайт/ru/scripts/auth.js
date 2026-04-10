// ============ ИНИЦИАЛИЗАЦИЯ ============
let supabaseClient = null;
let configData = null;

// Конфигурация сервисов
const SERVICES = {
    emailjs: {
        publicKey: 'kKTaWZRSBG53fUs48',
        serviceId: 'service_unn904o',
        templateId: 'template_ovhcvfa'
    },
    sms: {
        apiUrl: 'https://api.sms-activate.org/stubs/handler_api',
        apiKey: 'YOUR_SMS_API_KEY'
    }
};

// OAuth конфигурация
const OAUTH_CONFIG = {
    google: {
        clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
        redirectUri: window.location.origin + '/website/AresCraftXGeneral/auth.html'
    },
    discord: {
        clientId: 'YOUR_DISCORD_CLIENT_ID',
        redirectUri: window.location.origin + '/website/AresCraftXGeneral/auth.html'
    },
    github: {
        clientId: 'Ov23libvn2RUDcNzUtYb',
        redirectUri: 'http://localhost:8000/website/AresCraftXGeneral/auth.html'
    },
    telegram: {
        botUsername: 'arescraftx_auth_bot',
        redirectUri: window.location.origin + '/website/AresCraftXGeneral/auth.html'
    }
};

// Загрузка конфигурации
async function loadConfig() {
    try {
        const response = await fetch('../../json/sql.json');
        configData = await response.json();
        
        if (configData.supabase && configData.supabase.url !== 'your-project.supabase.co') {
            supabaseClient = window.supabase.createClient(
                configData.supabase.url,
                configData.supabase.anonKey
            );
            console.log('Supabase инициализирован');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка загрузки конфигурации:', error);
        return false;
    }
}

// Инициализация EmailJS
function initEmailJS() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init(SERVICES.emailjs.publicKey);
        console.log('EmailJS инициализирован');
    }
}

// ============ DOM элементы ============
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotPanel = document.getElementById('forgot-panel');
const tabBtns = document.querySelectorAll('.tab-btn');
const twofaModal = document.getElementById('twofaModal');
const verificationModal = document.getElementById('verificationModal');
const resetPasswordModal = document.getElementById('resetPasswordModal');

let pendingUser = null;
let pendingVerificationMethod = null;
let pendingResetUser = null;
let tempCodes = {};

// ============ ПРОВЕРКА СИЛЫ ПАРОЛЯ ============
function checkPasswordStrength(password) {
    let strength = 0;
    let tips = [];
    
    if (password.length >= 6) strength++;
    else tips.push('минимум 6 символов');
    
    if (/[A-Z]/.test(password)) strength++;
    else tips.push('заглавные буквы A-Z');
    
    if (/[a-z]/.test(password)) strength++;
    else tips.push('строчные буквы a-z');
    
    if (/[0-9]/.test(password)) strength++;
    else tips.push('цифры 0-9');
    
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    else tips.push('спецсимволы');
    
    let level = '', color = '', width = '';
    
    if (password.length === 0) {
        level = '';
        color = '#E0E5E8';
        width = '0%';
    } else if (strength <= 2) {
        level = 'Слабый';
        color = '#dc3545';
        width = '25%';
    } else if (strength <= 3) {
        level = 'Средний';
        color = '#DD8607';
        width = '50%';
    } else if (strength <= 4) {
        level = 'Хороший';
        color = '#28a745';
        width = '75%';
    } else {
        level = 'Сильный';
        color = '#28a745';
        width = '100%';
    }
    
    return {
        strength: strength,
        level: level,
        color: color,
        width: width,
        tips: tips,
        isValid: password.length >= 6 && /[A-Z]/.test(password) && /[a-z]/.test(password)
    };
}

// Добавляем индикатор силы пароля
const regPasswordInput = document.getElementById('regPassword');
if (regPasswordInput) {
    const strengthContainer = document.createElement('div');
    strengthContainer.className = 'password-strength';
    strengthContainer.innerHTML = `
        <div class="strength-bar"><div class="strength-fill"></div></div>
        <div class="strength-text"></div>
        <div class="strength-tips"></div>
    `;
    regPasswordInput.closest('.input-group').insertAdjacentElement('afterend', strengthContainer);
    
    regPasswordInput.addEventListener('input', (e) => {
        const password = e.target.value;
        const strength = checkPasswordStrength(password);
        
        const fill = strengthContainer.querySelector('.strength-fill');
        const text = strengthContainer.querySelector('.strength-text');
        const tipsDiv = strengthContainer.querySelector('.strength-tips');
        
        fill.style.width = strength.width;
        fill.style.backgroundColor = strength.color;
        
        if (password.length === 0) {
            text.innerHTML = '';
            tipsDiv.innerHTML = '';
        } else {
            text.innerHTML = `<span style="color: ${strength.color}">${strength.level}</span>`;
            if (strength.strength < 5 && strength.tips.length > 0) {
                tipsDiv.innerHTML = `<small>Требуется: ${strength.tips.join(', ')}</small>`;
            } else if (strength.strength >= 5) {
                tipsDiv.innerHTML = '<small style="color: #28a745;">✓ Отличный пароль!</small>';
            }
        }
    });
}

// Переключение видимости пароля
document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
        const input = e.target.closest('.input-group').querySelector('input');
        if (input.type === 'password') {
            input.type = 'text';
            e.target.classList.remove('fa-eye-slash');
            e.target.classList.add('fa-eye');
        } else {
            input.type = 'password';
            e.target.classList.remove('fa-eye');
            e.target.classList.add('fa-eye-slash');
        }
    });
});

// Переключение табов
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        loginForm.classList.remove('active');
        registerForm.classList.remove('active');
        forgotPanel.classList.remove('active');
        
        if (tab === 'login') {
            loginForm.classList.add('active');
        } else if (tab === 'register') {
            registerForm.classList.add('active');
        }
    });
});

// ============ РАБОТА С БАЗОЙ ДАННЫХ ============
async function getUsers() {
    if (!supabaseClient) {
        return [];
    }
    
    try {
        const { data, error } = await supabaseClient
            .from(configData.supabase.tables.users)
            .select('*');
        
        if (error) {
            console.error('Supabase getUsers error:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('Supabase getUsers exception:', error);
        return [];
    }
}

async function saveUser(user) {
    if (!supabaseClient) {
        return null;
    }
    
    const newUser = {
        id: Date.now().toString(),
        username: user.username,
        email: user.email,
        phone: user.phone || '',
        password: user.password,
        twofa_enabled: user.twofaEnabled || false,
        twofa_secret: null,
        verified: user.verified || false,
        avatar: user.avatar || null,
        provider: user.provider || 'local',
        provider_id: user.providerId || null,
        created_at: new Date().toISOString()
    };
    
    try {
        const { data, error } = await supabaseClient
            .from(configData.supabase.tables.users)
            .insert([newUser])
            .select();
        
        if (error) {
            console.error('Supabase saveUser error:', error);
            return null;
        }
        
        return data[0];
    } catch (error) {
        console.error('Supabase saveUser exception:', error);
        return null;
    }
}

async function findUserByLogin(login) {
    if (!supabaseClient) {
        return null;
    }
    
    try {
        const { data: emailData, error: emailError } = await supabaseClient
            .from(configData.supabase.tables.users)
            .select('*')
            .eq('email', login);
        
        if (!emailError && emailData && emailData.length > 0) {
            return emailData[0];
        }
        
        const { data: usernameData, error: usernameError } = await supabaseClient
            .from(configData.supabase.tables.users)
            .select('*')
            .eq('username', login);
        
        if (!usernameError && usernameData && usernameData.length > 0) {
            return usernameData[0];
        }
        
        return null;
    } catch (error) {
        console.error('findUserByLogin error:', error);
        return null;
    }
}

async function findUserByEmail(email) {
    if (!supabaseClient) {
        return null;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from(configData.supabase.tables.users)
            .select('*')
            .eq('email', email);
        
        if (error) {
            return null;
        }
        
        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        return null;
    }
}

async function updateUser(userId, updates) {
    if (!supabaseClient) {
        return null;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from(configData.supabase.tables.users)
            .update(updates)
            .eq('id', userId)
            .select();
        
        if (error) {
            console.error('Supabase updateUser error:', error);
            return null;
        }
        
        return data[0];
    } catch (error) {
        console.error('Supabase updateUser exception:', error);
        return null;
    }
}

// ============ ОТПРАВКА EMAIL через EmailJS ============
async function sendRealEmail(email, code, purpose = 'verification') {
    if (typeof emailjs === 'undefined') {
        return true;
    }
    
    try {
        const templateParams = {
            to_email: email,
            verification_code: code,
            app_name: 'AresCraftX',
            purpose: purpose,
            year: new Date().getFullYear()
        };
        
        const result = await emailjs.send(
            SERVICES.emailjs.serviceId,
            SERVICES.emailjs.templateId,
            templateParams
        );
        
        return result.status === 200;
    } catch (error) {
        console.error('EmailJS error:', error);
        return true;
    }
}

// ============ ОТПРАВКА SMS ============
async function sendRealSMS(phone, code) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    
    try {
        const response = await fetch('https://api.sms.ru/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICES.sms.apiKey}`
            },
            body: JSON.stringify({
                to: cleanPhone,
                msg: `AresCraftX: Ваш код подтверждения: ${code}`
            })
        });
        
        return response.ok;
    } catch (error) {
        return true;
    }
}

// ============ GOOGLE AUTH ============
async function initGoogleAuth() {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => {
            if (window.google && window.google.accounts) {
                window.google.accounts.id.initialize({
                    client_id: OAUTH_CONFIG.google.clientId,
                    callback: handleGoogleCredential
                });
                console.log('Google Auth инициализирован');
            }
            resolve();
        };
        script.onerror = () => {
            console.error('Google Auth load error');
            resolve();
        };
        document.head.appendChild(script);
    });
}

async function handleGoogleCredential(response) {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        
        let user = await findUserByEmail(payload.email);
        
        if (!user) {
            let finalUsername = payload.name.replace(/ /g, '_').toLowerCase();
            let counter = 1;
            let existingUser = await findUserByLogin(finalUsername);
            while (existingUser) {
                finalUsername = `${payload.name.replace(/ /g, '_').toLowerCase()}_${counter}`;
                counter++;
                existingUser = await findUserByLogin(finalUsername);
            }
            
            user = await saveUser({
                username: finalUsername,
                email: payload.email,
                phone: '',
                password: Math.random().toString(36),
                twofaEnabled: false,
                avatar: payload.picture,
                provider: 'google',
                providerId: payload.sub,
                verified: true
            });
            showNotification(`Добро пожаловать, ${payload.name}!`, 'success');
        }
        
        await loginSuccess(user, true);
    } catch (error) {
        console.error('Google auth error:', error);
        showNotification('Ошибка входа через Google', 'error');
    }
}

// ============ DISCORD AUTH ============
function initDiscordAuth() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        if (accessToken) {
            fetchDiscordUser(accessToken);
            window.location.hash = '';
        }
    }
}

window.discordLogin = function() {
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${OAUTH_CONFIG.discord.clientId}&redirect_uri=${encodeURIComponent(OAUTH_CONFIG.discord.redirectUri)}&response_type=token&scope=identify%20email`;
    window.location.href = authUrl;
};

async function fetchDiscordUser(accessToken) {
    try {
        const response = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const userData = await response.json();
        
        let user = await findUserByEmail(userData.email);
        
        if (!user) {
            let finalUsername = userData.username;
            let counter = 1;
            let existingUser = await findUserByLogin(finalUsername);
            while (existingUser) {
                finalUsername = `${userData.username}_${counter}`;
                counter++;
                existingUser = await findUserByLogin(finalUsername);
            }
            
            user = await saveUser({
                username: finalUsername,
                email: userData.email || `${userData.id}@discord.com`,
                phone: '',
                password: Math.random().toString(36),
                twofaEnabled: false,
                avatar: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
                provider: 'discord',
                providerId: userData.id.toString(),
                verified: true
            });
            showNotification(`Добро пожаловать, ${userData.username}!`, 'success');
        }
        
        await loginSuccess(user, true);
    } catch (error) {
        console.error('Discord auth error:', error);
        showNotification('Ошибка входа через Discord', 'error');
    }
}

// ============ GITHUB AUTH (через Supabase) ============

// Функция входа через GitHub
window.githubLogin = async function() {
    if (!supabaseClient) {
        showNotification('Ошибка подключения к базе данных', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: window.location.origin + '/website/AresCraftXGeneral/auth.html',
                scopes: 'user:email'
            }
        });
        
        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('GitHub login error:', error);
        showNotification('Ошибка входа через GitHub: ' + error.message, 'error');
    }
};

// Инициализация - проверяем сессию Supabase после возврата
async function initGithubAuth() {
    if (!supabaseClient) {
        console.log('GitHub auth ожидает Supabase');
        return;
    }
    
    // Получаем текущую сессию от Supabase
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
        console.error('Get session error:', error);
        return;
    }
    
    if (session && session.user) {
        // Есть активная сессия - обрабатываем
        await handleSupabaseGithubSession(session);
        // Выходим из Supabase сессии
        await supabaseClient.auth.signOut();
    }
}

// Обработка сессии от Supabase
async function handleSupabaseGithubSession(session) {
    try {
        showNotification('Авторизация через GitHub...', 'info');
        
        const supabaseUser = session.user;
        const userEmail = supabaseUser.email;
        const userName = supabaseUser.user_metadata?.user_name || 
                         supabaseUser.user_metadata?.name || 
                         (userEmail ? userEmail.split('@')[0] : 'github_user');
        const avatarUrl = supabaseUser.user_metadata?.avatar_url;
        const providerId = supabaseUser.id;
        
        // Проверяем, существует ли пользователь в нашей таблице
        let user = await findUserByEmail(userEmail);
        
        if (!user) {
            let finalUsername = userName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            let counter = 1;
            let existingUser = await findUserByLogin(finalUsername);
            while (existingUser) {
                finalUsername = `${userName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${counter}`;
                counter++;
                existingUser = await findUserByLogin(finalUsername);
            }
            
            user = await saveUser({
                username: finalUsername,
                email: userEmail,
                phone: '',
                password: Math.random().toString(36),
                twofaEnabled: false,
                avatar: avatarUrl,
                provider: 'github',
                providerId: providerId,
                verified: true
            });
            showNotification(`Добро пожаловать, ${userName}!`, 'success');
        } else {
            showNotification(`С возвращением, ${user.username}!`, 'success');
        }
        
        await loginSuccess(user, true);
        
    } catch (error) {
        console.error('Handle GitHub session error:', error);
        showNotification('Ошибка обработки GitHub авторизации', 'error');
    }
}

// Слушаем изменения сессии Supabase
if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            handleSupabaseGithubSession(session);
            supabaseClient.auth.signOut();
        }
    });
}

// Привязка кнопки GitHub
const githubLoginBtn = document.getElementById('githubLogin');
if (githubLoginBtn) {
    // Удаляем старые обработчики, чтобы не было дублирования
    const newBtn = githubLoginBtn.cloneNode(true);
    githubLoginBtn.parentNode.replaceChild(newBtn, githubLoginBtn);
    
    newBtn.addEventListener('click', () => {
        if (typeof window.githubLogin === 'function') {
            window.githubLogin();
        } else {
            showNotification('GitHub авторизация не инициализирована', 'error');
        }
    });
}

// ============ TELEGRAM AUTH (ПРОСТОЙ РАБОЧИЙ СПОСОБ) ============

const TELEGRAM_BOT_TOKEN = '8664019869:AAGVLw5YcrAMRbcD857JobUyEOh6VtXe2MM';

// Кнопка Telegram открывает бота
function setupTelegramButton() {
    const telegramBtn = document.getElementById('telegramLogin');
    if (!telegramBtn) return;
    
    telegramBtn.onclick = () => {
        // Открываем чат с ботом
        window.open('https://t.me/arescraftx_auth_bot', '_blank');
        showNotification('Перейдите в Telegram и отправьте команду /start', 'info');
        
        // Запрашиваем код у пользователя
        setTimeout(() => {
            const code = prompt('Введите код из Telegram:');
            if (code && code.length === 6) {
                verifyTelegramCode(code);
            }
        }, 3000);
    };
}

// Проверка кода
async function verifyTelegramCode(code) {
    try {
        // Проверяем код через бота
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
        const data = await response.json();
        
        // Ищем сообщение с этим кодом
        const message = data.result.find(msg => 
            msg.message && msg.message.text === code
        );
        
        if (message) {
            const user = message.message.from;
            
            const userEmail = `${user.id}@telegram.user`;
            let existingUser = await findUserByEmail(userEmail);
            
            if (!existingUser) {
                let finalUsername = user.username || `telegram_${user.id}`;
                let counter = 1;
                let existing = await findUserByLogin(finalUsername);
                while (existing) {
                    finalUsername = `${user.username || 'telegram'}_${counter}`;
                    counter++;
                    existing = await findUserByLogin(finalUsername);
                }
                
                existingUser = await saveUser({
                    username: finalUsername,
                    email: userEmail,
                    phone: '',
                    password: Math.random().toString(36),
                    twofaEnabled: false,
                    provider: 'telegram',
                    providerId: user.id.toString(),
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    verified: true
                });
            }
            
            await loginSuccess(existingUser, true);
        } else {
            showNotification('Неверный код', 'error');
        }
    } catch (error) {
        console.error('Verify error:', error);
        showNotification('Ошибка проверки кода', 'error');
    }
}

setupTelegramButton();
// ============ ГЕНЕРАЦИЯ И ОТПРАВКА КОДА ============
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationCode(email, phone, method, purpose = 'verification') {
    const code = generateCode();
    const key = `${purpose}_${email || phone}`;
    tempCodes[key] = { code, expiry: Date.now() + 5 * 60 * 1000 };
    
    const message = document.getElementById('verificationMessage');
    
    try {
        if (method === 'email' && email) {
            await sendRealEmail(email, code, purpose);
            if (message) {
                message.innerHTML = `Код подтверждения отправлен на ${email}<br><small>Проверьте почту (папку Спам)</small>`;
            }
            showNotification(`Код отправлен на ${email}`, 'success');
        } else if (method === 'sms' && phone) {
            await sendRealSMS(phone, code);
            if (message) {
                message.innerHTML = `SMS код отправлен на ${phone}<br><small>Проверьте телефон</small>`;
            }
            showNotification(`Код отправлен на ${phone}`, 'success');
        }
        return code;
    } catch (error) {
        console.error('Send verification error:', error);
        showNotification('Ошибка отправки кода. Попробуйте позже.', 'error');
        return null;
    }
}

async function verifyCode(inputCode, email, phone, purpose = 'verification') {
    const key = `${purpose}_${email || phone}`;
    const stored = tempCodes[key];
    
    if (!stored) {
        showNotification('Код не найден. Запросите новый.', 'error');
        return false;
    }
    
    if (Date.now() > stored.expiry) {
        showNotification('Код истек. Запросите новый.', 'error');
        delete tempCodes[key];
        return false;
    }
    
    if (inputCode === stored.code) {
        delete tempCodes[key];
        return true;
    }
    
    showNotification('Неверный код', 'error');
    return false;
}

// ============ РЕГИСТРАЦИЯ ============
const registerSubmitBtn = document.getElementById('registerSubmit');
if (registerSubmitBtn) {
    registerSubmitBtn.addEventListener('click', async () => {
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPass = document.getElementById('regConfirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const verifyMethod = document.querySelector('input[name="verifyMethod"]:checked')?.value || 'email';
        
        if (!username || !email || !password || !confirmPass) {
            showNotification('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }
        
        if (password !== confirmPass) {
            showNotification('Пароли не совпадают', 'error');
            return;
        }
        
        const strength = checkPasswordStrength(password);
        if (!strength.isValid) {
            showNotification('Пароль слишком слабый! Используйте минимум 6 символов, заглавные и строчные буквы', 'error');
            return;
        }
        
        if (!acceptTerms) {
            showNotification('Необходимо принять пользовательское соглашение', 'error');
            return;
        }
        
        const existingUser = await findUserByLogin(username);
        if (existingUser) {
            showNotification('Имя пользователя уже занято', 'error');
            return;
        }
        
        const existingEmail = await findUserByEmail(email);
        if (existingEmail) {
            showNotification('Email уже зарегистрирован', 'error');
            return;
        }
        
        pendingUser = {
            username: username,
            email: email,
            phone: phone,
            password: password,
            twofaEnabled: false,
            verified: false,
            provider: 'local',
            providerId: null
        };
        pendingVerificationMethod = verifyMethod;
        
        const codeSent = await sendVerificationCode(email, phone, verifyMethod, 'verification');
        if (codeSent) {
            verificationModal.classList.add('show');
        }
    });
}

// Подтверждение регистрации
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener('click', async () => {
        const enteredCode = document.getElementById('verificationCode').value;
        const email = pendingUser?.email;
        const phone = pendingUser?.phone;
        
        if (!enteredCode) {
            showNotification('Введите код подтверждения', 'error');
            return;
        }
        
        const isValid = await verifyCode(enteredCode, email, phone, 'verification');
        
        if (isValid && pendingUser) {
            const savedUser = await saveUser(pendingUser);
            if (savedUser) {
                showNotification('Регистрация успешно завершена!', 'success');
                verificationModal.classList.remove('show');
                clearRegisterForm();
                if (tabBtns[0]) tabBtns[0].click();
                pendingUser = null;
                document.getElementById('verificationCode').value = '';
            }
        }
    });
}

const cancelVerifyBtn = document.getElementById('cancelVerifyBtn');
if (cancelVerifyBtn) {
    cancelVerifyBtn.addEventListener('click', () => {
        verificationModal.classList.remove('show');
        pendingUser = null;
        document.getElementById('verificationCode').value = '';
    });
}

const resendCodeBtn = document.getElementById('resendCode');
if (resendCodeBtn) {
    resendCodeBtn.addEventListener('click', async () => {
        if (pendingUser) {
            await sendVerificationCode(pendingUser.email, pendingUser.phone, pendingVerificationMethod, 'verification');
        }
    });
}

// ============ ВХОД ============
const loginSubmitBtn = document.getElementById('loginSubmit');
if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener('click', async () => {
        const login = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        if (!login || !password) {
            showNotification('Пожалуйста, заполните все поля', 'error');
            return;
        }
        
        const user = await findUserByLogin(login);
        
        if (!user) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        if (user.password !== password) {
            showNotification('Неверный пароль', 'error');
            return;
        }
        
        if (user.twofa_enabled) {
            pendingUser = user;
            twofaModal.classList.add('show');
            return;
        }
        
        await loginSuccess(user, rememberMe);
    });
}

// ============ 2FA ============
const verifyTwofaBtn = document.getElementById('verifyTwofa');
if (verifyTwofaBtn) {
    verifyTwofaBtn.addEventListener('click', async () => {
        const code = document.getElementById('twofaCode').value;
        
        if (code && code.length === 6) {
            await loginSuccess(pendingUser, false);
            twofaModal.classList.remove('show');
            pendingUser = null;
            document.getElementById('twofaCode').value = '';
        } else {
            showNotification('Неверный код 2FA', 'error');
        }
    });
}

const cancelTwofaBtn = document.getElementById('cancelTwofa');
if (cancelTwofaBtn) {
    cancelTwofaBtn.addEventListener('click', () => {
        twofaModal.classList.remove('show');
        pendingUser = null;
        document.getElementById('twofaCode').value = '';
    });
}

// ============ ВОССТАНОВЛЕНИЕ ПАРОЛЯ ============
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('active');
        forgotPanel.classList.add('active');
    });
}

const backToLoginBtn = document.getElementById('backToLogin');
if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
        forgotPanel.classList.remove('active');
        loginForm.classList.add('active');
    });
}

const sendResetLinkBtn = document.getElementById('sendResetLink');
if (sendResetLinkBtn) {
    sendResetLinkBtn.addEventListener('click', async () => {
        const login = document.getElementById('forgotUsername').value.trim();
        
        if (!login) {
            showNotification('Введите имя пользователя или email', 'error');
            return;
        }
        
        const user = await findUserByLogin(login);
        
        if (!user) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        pendingResetUser = user;
        await sendVerificationCode(user.email, user.phone, 'email', 'reset');
        resetPasswordModal.classList.add('show');
    });
}

const confirmResetBtn = document.getElementById('confirmResetBtn');
if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', async () => {
        const resetCode = document.getElementById('resetCode').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        
        if (!resetCode || !newPassword || !confirmPassword) {
            showNotification('Заполните все поля', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification('Пароли не совпадают', 'error');
            return;
        }
        
        const strength = checkPasswordStrength(newPassword);
        if (!strength.isValid) {
            showNotification('Пароль слишком слабый!', 'error');
            return;
        }
        
        const isValid = await verifyCode(resetCode, pendingResetUser?.email, pendingResetUser?.phone, 'reset');
        
        if (isValid && pendingResetUser) {
            const updated = await updateUser(pendingResetUser.id, { password: newPassword });
            if (updated) {
                showNotification('Пароль успешно изменен!', 'success');
                resetPasswordModal.classList.remove('show');
                
                document.getElementById('resetCode').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmNewPassword').value = '';
                
                forgotPanel.classList.remove('active');
                loginForm.classList.add('active');
                pendingResetUser = null;
            }
        }
    });
}

const cancelResetBtn = document.getElementById('cancelResetBtn');
if (cancelResetBtn) {
    cancelResetBtn.addEventListener('click', () => {
        resetPasswordModal.classList.remove('show');
        pendingResetUser = null;
        document.getElementById('resetCode').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
    });
}

// ============ СОЦИАЛЬНЫЙ ВХОД ============
const googleLoginBtn = document.getElementById('googleLogin');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        if (window.google && window.google.accounts) {
            window.google.accounts.id.prompt();
        } else {
            showNotification('Google авторизация не инициализирована', 'error');
        }
    });
}

const discordLoginBtn = document.getElementById('discordLogin');
if (discordLoginBtn) {
    discordLoginBtn.addEventListener('click', () => {
        if (typeof window.discordLogin === 'function') {
            window.discordLogin();
        } else {
            showNotification('Discord авторизация не инициализирована', 'error');
        }
    });
}

const telegramLoginBtn = document.getElementById('telegramLogin');
if (telegramLoginBtn) {
    telegramLoginBtn.addEventListener('click', () => {
        showNotification('Нажмите на виджет Telegram для входа', 'info');
    });
}

// ============ УСПЕШНЫЙ ВХОД ============
async function loginSuccess(user, rememberMe) {
    const session = {
        userId: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        loginTime: Date.now()
    };
    
    if (rememberMe) {
        localStorage.setItem('arescraftx_session', JSON.stringify({
            ...session,
            expiry: Date.now() + 30 * 24 * 60 * 60 * 1000
        }));
    } else {
        sessionStorage.setItem('arescraftx_session', JSON.stringify(session));
    }
    
    showNotification(`Добро пожаловать, ${user.username}!`, 'success');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}

// ============ ВЫХОД ИЗ АККАУНТА ============
function logout() {
    localStorage.removeItem('arescraftx_session');
    sessionStorage.removeItem('arescraftx_session');
    
    showNotification('Вы вышли из аккаунта', 'success');
    
    setTimeout(() => {
        window.location.href = 'auth.html';
    }, 1000);
}

function addLogoutButton() {
    const logoutBtn = document.createElement('button');
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Выйти';
    logoutBtn.className = 'logout-btn';
    logoutBtn.onclick = logout;
    
    logoutBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #DD8607, #C25006);
        border: none;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    logoutBtn.onmouseenter = () => {
        logoutBtn.style.transform = 'translateY(-2px)';
        logoutBtn.style.boxShadow = '0 4px 12px rgba(221, 134, 7, 0.4)';
    };
    logoutBtn.onmouseleave = () => {
        logoutBtn.style.transform = 'translateY(0)';
        logoutBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    };
    
    document.body.appendChild(logoutBtn);
}

function checkSession() {
    const session = localStorage.getItem('arescraftx_session') || sessionStorage.getItem('arescraftx_session');
    const currentPath = window.location.pathname;
    
    if (session && (currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('index.html'))) {
        addLogoutButton();
        try {
            const userData = JSON.parse(session);
            showNotification(`Вы вошли как ${userData.username}`, 'success');
        } catch(e) {}
    }
}

// ============ ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ ============
function showTermsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header">
                <i class="fas fa-file-alt"></i>
                <h3>Пользовательское соглашение AresCraftX</h3>
            </div>
            <div style="text-align: left; color: #E0E5E8; padding: 20px;">
                <h4>1. Общие положения</h4>
                <p>1.1. Настоящее соглашение регулирует отношения между администрацией AresCraftX и пользователем.</p>
                <p>1.2. Используя сервис, вы соглашаетесь с условиями настоящего соглашения.</p>
                <p>1.3. Администрация оставляет за собой право изменять условия без предварительного уведомления.</p>
                
                <h4>2. Права и обязанности пользователя</h4>
                <p>2.1. Пользователь обязуется предоставлять достоверную информацию при регистрации.</p>
                <p>2.2. Пользователь несет ответственность за сохранность своих учетных данных.</p>
                <p>2.3. Запрещается использовать сервис для противоправных действий.</p>
                
                <h4>3. Права и обязанности администрации</h4>
                <p>3.1. Администрация обязуется обеспечивать работоспособность сервиса.</p>
                <p>3.2. Администрация оставляет за собой право блокировать аккаунты за нарушения.</p>
                <p>3.3. Администрация не несет ответственности за действия пользователей.</p>
                
                <h4>4. Конфиденциальность</h4>
                <p>4.1. Личные данные пользователей защищены и не передаются третьим лицам.</p>
                <p>4.2. Администрация использует данные только для обеспечения работы сервиса.</p>
                
                <h4>5. Ответственность</h4>
                <p>5.1. Сервис предоставляется "как есть" без каких-либо гарантий.</p>
                <p>5.2. Администрация не несет ответственности за убытки, связанные с использованием сервиса.</p>
                
                <h4>6. Заключительные положения</h4>
                <p>6.1. Продолжение использования сервиса означает принятие новых условий.</p>
                <p>6.2. Все споры решаются в соответствии с законодательством.</p>
                <p>6.3. Дата последнего обновления: 01.01.2024</p>
            </div>
            <button class="submit-btn" id="closeTermsModal">Закрыть</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('closeTermsModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

const termsLink = document.getElementById('termsLink');
if (termsLink) {
    termsLink.addEventListener('click', (e) => {
        e.preventDefault();
        showTermsModal();
    });
}

const termsInline = document.querySelector('.terms-inline');
if (termsInline) {
    termsInline.addEventListener('click', (e) => {
        e.preventDefault();
        showTermsModal();
    });
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function showNotification(message, type) {
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#DD8607'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: 'Inter', sans-serif;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function clearRegisterForm() {
    const usernameInput = document.getElementById('regUsername');
    const emailInput = document.getElementById('regEmail');
    const phoneInput = document.getElementById('regPhone');
    const passwordInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');
    const termsCheckbox = document.getElementById('acceptTerms');
    
    if (usernameInput) usernameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (confirmInput) confirmInput.value = '';
    if (termsCheckbox) termsCheckbox.checked = false;
    
    const strengthContainer = document.querySelector('.password-strength');
    if (strengthContainer) {
        const fill = strengthContainer.querySelector('.strength-fill');
        const text = strengthContainer.querySelector('.strength-text');
        const tipsDiv = strengthContainer.querySelector('.strength-tips');
        if (fill) fill.style.width = '0%';
        if (text) text.innerHTML = '';
        if (tipsDiv) tipsDiv.innerHTML = '';
    }
}

// Добавляем стили анимаций
const styleElement = document.createElement('style');
styleElement.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(styleElement);
// Инициализация при загрузке
window.addEventListener('load', async () => {
    await loadConfig();
    initEmailJS();
    await initGoogleAuth();
    initDiscordAuth();
    initGithubAuth();
    
    // Telegram инициализация
    initTelegramAuth();
    setupTelegramButton();
    
    checkSession();
});
// ============ ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ============
window.addEventListener('load', async () => {
    const supabaseReady = await loadConfig();
    initEmailJS();
    await initGoogleAuth();
    initDiscordAuth();
    
    if (supabaseReady && supabaseClient) {
        await initGithubAuth();
    } else {
        console.log('GitHub auth пропущен - Supabase не инициализирован');
        const githubBtn = document.getElementById('githubLogin');
        if (githubBtn) {
            githubBtn.style.opacity = '0.5';
            githubBtn.title = 'GitHub авторизация недоступна';
        }
    }
    
    initTelegramAuth();
    checkSession();
    
    const session = localStorage.getItem('arescraftx_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            if (data.expiry && Date.now() < data.expiry) {
                const currentPath = window.location.pathname;
                if (!currentPath.includes('index.html') && currentPath !== '/' && !currentPath.endsWith('index.html')) {
                    window.location.href = 'index.html';
                }
            } else {
                localStorage.removeItem('arescraftx_session');
            }
        } catch(e) {
            localStorage.removeItem('arescraftx_session');
        }
    }
});
