import { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function InputField({ label, type, value, onChange, placeholder, error, autoComplete }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div>
      <label className="block text-xs font-bold text-discord-text-muted uppercase tracking-wide mb-1.5">
        {label} <span className="text-discord-red">*</span>
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full bg-discord-darker text-discord-text rounded px-3 py-2.5 text-sm outline-none transition-colors border ${
            error
              ? 'border-discord-red focus:border-discord-red'
              : 'border-discord-separator focus:border-discord-brand'
          } placeholder-discord-text-muted/60`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-discord-text-muted hover:text-discord-text transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-discord-red flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const setField = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setGlobalError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.email) errors.email = 'E-posta zorunludur.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Geçerli bir e-posta girin.';
    if (!form.password) errors.password = 'Şifre zorunludur.';
    else if (form.password.length < 6) errors.password = 'Şifre en az 6 karakter olmalıdır.';
    if (mode === 'register') {
      if (!form.username) errors.username = 'Kullanıcı adı zorunludur.';
      else if (form.username.length < 2) errors.username = 'Kullanıcı adı en az 2 karakter olmalıdır.';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setGlobalError('');

    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      // On success, AuthContext will redirect or re-render
    } catch (err) {
      const msg = err?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      // Try to map common backend errors to friendly Turkish messages
      if (msg.includes('Invalid credentials') || msg.includes('invalid credentials')) {
        setGlobalError('E-posta veya şifre hatalı.');
      } else if (msg.includes('already taken') || msg.includes('already exists')) {
        setGlobalError('Bu kullanıcı adı veya e-posta zaten kullanımda.');
      } else if (msg.includes('not found')) {
        setGlobalError('Kullanıcı bulunamadı.');
      } else {
        setGlobalError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setForm({ email: '', username: '', password: '' });
    setFieldErrors({});
    setGlobalError('');
  };

  return (
    <div className="min-h-screen bg-discord-medium flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #1e1f22 0%, #2b2d31 50%, #23272a 100%)',
      }}
    >
      {/* Card */}
      <div className="w-full max-w-md bg-discord-dark rounded-xl shadow-2xl p-8">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <div className="w-12 h-12 bg-discord-brand rounded-full flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 71 55" fill="white" className="w-7 h-7">
                <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5633 44.2813 17.6387 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3933 44.2785 53.4856 44.2898 53.5527 44.3433C53.9080 44.6363 54.2803 44.9293 54.6554 45.2082C54.7841 45.304 54.7757 45.5041 54.6358 45.5858C52.8671 46.6197 51.0284 47.4931 49.0974 48.2228C48.9715 48.2707 48.9155 48.4172 48.9799 48.5383C50.0405 50.6035 51.2579 52.5699 52.5991 54.435C52.6551 54.5139 52.7558 54.5477 52.8482 54.5195C58.6484 52.7249 64.5310 50.0174 70.6039 45.5576C70.657 45.5182 70.6906 45.459 70.6962 45.3942C72.1916 30.1270 68.2909 16.8270 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1580C17.3451 26.2024 20.1717 22.9907 23.7259 22.9907C27.308 22.9907 30.1626 26.2280 30.1066 30.1580C30.1066 34.1136 27.2520 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1580C40.9371 26.2024 43.7636 22.9907 47.3178 22.9907C50.9 22.9907 53.7545 26.2280 53.6986 30.1580C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-discord-text">
            {mode === 'login' ? 'Tekrar hoş geldin!' : 'Hesap oluştur'}
          </h1>
          <p className="text-discord-text-muted text-sm mt-1">
            {mode === 'login' ? 'Discord Clone\'a giriş yap' : 'Discord Clone\'a katıl'}
          </p>
        </div>

        {/* Global error */}
        {globalError && (
          <div className="mb-4 p-3 bg-discord-red/15 border border-discord-red/40 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-discord-red flex-shrink-0 mt-0.5" />
            <p className="text-sm text-discord-red">{globalError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <InputField
            label="E-Posta"
            type="email"
            value={form.email}
            onChange={setField('email')}
            placeholder="ornek@email.com"
            error={fieldErrors.email}
            autoComplete="email"
          />

          {mode === 'register' && (
            <InputField
              label="Kullanıcı Adı"
              type="text"
              value={form.username}
              onChange={setField('username')}
              placeholder="kullanici_adi"
              error={fieldErrors.username}
              autoComplete="username"
            />
          )}

          <InputField
            label="Şifre"
            type="password"
            value={form.password}
            onChange={setField('password')}
            placeholder="••••••••"
            error={fieldErrors.password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {mode === 'login' && (
            <button type="button" className="text-xs text-discord-text-link hover:underline">
              Şifreni mi unuttun?
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-discord-brand hover:bg-discord-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded font-semibold text-sm transition-colors mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{mode === 'login' ? 'Giriş yapılıyor...' : 'Kayıt olunuyor...'}</span>
              </>
            ) : (
              mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-4 text-sm text-discord-text-muted">
          {mode === 'login' ? (
            <>
              Hesabın yok mu?{' '}
              <button onClick={switchMode} className="text-discord-text-link hover:underline font-medium">
                Kayıt ol
              </button>
            </>
          ) : (
            <>
              Zaten hesabın var mı?{' '}
              <button onClick={switchMode} className="text-discord-text-link hover:underline font-medium">
                Giriş yap
              </button>
            </>
          )}
        </div>

        {/* Terms */}
        {mode === 'register' && (
          <p className="mt-4 text-xs text-discord-text-muted leading-relaxed">
            Kayıt olarak{' '}
            <span className="text-discord-text-link cursor-pointer hover:underline">Hizmet Koşulları</span>
            {' '}ve{' '}
            <span className="text-discord-text-link cursor-pointer hover:underline">Gizlilik Politikası</span>
            {'\'nı'} kabul etmiş olursun.
          </p>
        )}
      </div>
    </div>
  );
}
