import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';

type Mode = 'login' | 'register';

function parseFirebaseError(message: string): string {
  if (message.includes('invalid-credential') || message.includes('user-not-found') || message.includes('wrong-password'))
    return 'Correo o contraseña incorrectos';
  if (message.includes('email-already-in-use'))
    return 'Ya existe una cuenta con este correo';
  if (message.includes('weak-password'))
    return 'La contraseña debe tener mínimo 6 caracteres';
  if (message.includes('invalid-email'))
    return 'El correo electrónico no es válido';
  if (message.includes('too-many-requests'))
    return 'Demasiados intentos fallidos. Intenta más tarde';
  if (message.includes('user-disabled'))
    return 'Esta cuenta ha sido deshabilitada';
  if (message.includes('network-request-failed'))
    return 'Error de conexión. Verifica tu internet';
  return 'Ocurrió un error. Intenta de nuevo';
}

export default function Login() {
  const { user, loading, signInWithGoogle, signInWithEmailPassword, signUpWithEmailPassword } = useAuthContext();
  const navigate = useNavigate();

  // ── Modo actual
  const [mode, setMode] = useState<Mode>('login');
  // Controla la visibilidad del panel para la transición
  const [panelVisible, setPanelVisible] = useState(true);

  // ── Campos login
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd]   = useState(false);

  // ── Campos registro
  const [regEmail, setRegEmail]             = useState('');
  const [regPassword, setRegPassword]       = useState('');
  const [regConfirm, setRegConfirm]         = useState('');
  const [showRegPwd, setShowRegPwd]         = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // ── Estados de carga y error
  const [submitLoading, setSubmitLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError]         = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a1628]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
      </div>
    );
  }

  const isLoading = submitLoading || googleLoading;

  // Cambia de modo con fade-out → swap → fade-in
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setPanelVisible(false);
    setFormError(null);
    setTimeout(() => {
      setMode(next);
      setLoginEmail(''); setLoginPassword(''); setShowLoginPwd(false);
      setRegEmail(''); setRegPassword(''); setRegConfirm('');
      setShowRegPwd(false); setShowRegConfirm(false);
      setPanelVisible(true);
    }, 180);
  };

  // ── Login con email
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setFormError('Completa todos los campos');
      return;
    }
    setFormError(null);
    setSubmitLoading(true);
    try {
      await signInWithEmailPassword(loginEmail.trim(), loginPassword);
    } catch (err) {
      setFormError(parseFirebaseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitLoading(false);
    }
  };

  // ── Registro con email
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword || !regConfirm) {
      setFormError('Completa todos los campos');
      return;
    }
    if (regPassword !== regConfirm) {
      setFormError('Las contraseñas no coinciden');
      return;
    }
    if (regPassword.length < 6) {
      setFormError('La contraseña debe tener mínimo 6 caracteres');
      return;
    }
    setFormError(null);
    setSubmitLoading(true);
    try {
      await signUpWithEmailPassword(regEmail.trim(), regPassword, '');
    } catch (err) {
      setFormError(parseFirebaseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitLoading(false);
    }
  };

  // ── Google (sirve para login y registro)
  const handleGoogle = async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setFormError(parseFirebaseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ══════════════════════════════════════
          LEFT — Panel de formulario
      ══════════════════════════════════════ */}
      <div className="w-full md:w-[45%] bg-white flex flex-col justify-between px-10 lg:px-16 py-10 overflow-y-auto">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-none">
            <ToothIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 tracking-tight">DentLink</span>
        </div>

        {/* Contenido animado */}
        <div
          className="w-full max-w-sm mx-auto transition-all duration-200"
          style={{ opacity: panelVisible ? 1 : 0, transform: panelVisible ? 'translateY(0)' : 'translateY(8px)' }}
        >
          {mode === 'login' ? (
            <LoginPanel
              email={loginEmail}       setEmail={setLoginEmail}
              password={loginPassword} setPassword={setLoginPassword}
              showPwd={showLoginPwd}   setShowPwd={setShowLoginPwd}
              onSubmit={handleLogin}
              onGoogle={handleGoogle}
              onSwitch={() => switchMode('register')}
              isLoading={isLoading}
              submitLoading={submitLoading}
              googleLoading={googleLoading}
              formError={formError}
              clearError={() => setFormError(null)}
            />
          ) : (
            <RegisterPanel
              email={regEmail}             setEmail={setRegEmail}
              password={regPassword}       setPassword={setRegPassword}
              confirm={regConfirm}         setConfirm={setRegConfirm}
              showPwd={showRegPwd}         setShowPwd={setShowRegPwd}
              showConfirm={showRegConfirm} setShowConfirm={setShowRegConfirm}
              onSubmit={handleRegister}
              onGoogle={handleGoogle}
              onSwitch={() => switchMode('login')}
              isLoading={isLoading}
              submitLoading={submitLoading}
              googleLoading={googleLoading}
              formError={formError}
              clearError={() => setFormError(null)}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-400 text-center">
          © {new Date().getFullYear()} DentLink · Sistema de Gestión Odontológica
        </p>
      </div>

      {/* ══════════════════════════════════════
          RIGHT — Panel de marca (estático)
      ══════════════════════════════════════ */}
      <div className="hidden md:flex flex-1 relative overflow-hidden bg-[#0a1628]">

        {/* Glow blobs */}
        <div className="absolute top-[-80px] right-[-80px] w-[480px] h-[480px] rounded-full bg-blue-600/12 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-60px] left-[-60px] w-80 h-80 rounded-full bg-blue-400/10 blur-[80px] pointer-events-none" />

        {/* Grid sutil */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.6) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Contenido */}
        <div className="relative w-full flex flex-col items-center justify-center px-14 xl:px-20 text-white">

          {/* Ilustración diente */}
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-blue-500/15 rounded-full blur-3xl scale-[1.8]" />
            <svg viewBox="0 0 160 210" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative w-32 h-32">
              <ellipse cx="80" cy="95" rx="72" ry="78"
                fill="rgba(37,99,235,0.07)" stroke="rgba(96,165,250,0.12)" strokeWidth="1" />
              <path
                d="M80,22 C60,22 36,32 32,54 C28,74 33,95 43,112 L53,158 Q55,170 63,168 Q71,165 73,155 Q77,149 80,149 Q83,149 87,155 Q89,165 97,168 Q105,170 107,158 L117,112 C127,95 132,74 128,54 C124,32 100,22 80,22 Z"
                fill="rgba(37,99,235,0.22)" stroke="rgba(96,165,250,0.65)" strokeWidth="1.5"
              />
              <path d="M55,40 C48,50 45,63 47,76"
                stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinecap="round" />
              <path d="M56,34 Q68,23 80,26 Q92,23 104,34"
                stroke="rgba(96,165,250,0.45)" strokeWidth="1.5" fill="none" />
              <path d="M80,149 L80,168"
                stroke="rgba(96,165,250,0.3)" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>

          {/* Texto */}
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold leading-snug mb-3 text-white">
              Gestión dental<br />sin complicaciones
            </h2>
            <p className="text-sm text-blue-200/55 max-w-xs leading-relaxed">
              Pacientes, citas, tratamientos y pagos — todo en un solo lugar.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-2.5 w-full max-w-[260px]">
            {[
              { label: 'Historial clínico completo', sub: 'Fichas y tratamientos' },
              { label: 'Agenda inteligente',          sub: 'Citas y recordatorios' },
              { label: 'Control financiero',          sub: 'Pagos y movimientos'   },
            ].map(({ label, sub }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-none" />
                <div>
                  <p className="text-xs font-semibold text-white/85">{label}</p>
                  <p className="text-xs text-white/35">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════
   Sub-componentes de formulario
══════════════════════════════════════════════════ */

interface LoginPanelProps {
  email: string;       setEmail: (v: string) => void;
  password: string;    setPassword: (v: string) => void;
  showPwd: boolean;    setShowPwd: (v: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onGoogle: () => void;
  onSwitch: () => void;
  isLoading: boolean;
  submitLoading: boolean;
  googleLoading: boolean;
  formError: string | null;
  clearError: () => void;
}

function LoginPanel({
  email, setEmail, password, setPassword, showPwd, setShowPwd,
  onSubmit, onGoogle, onSwitch,
  isLoading, submitLoading, googleLoading, formError, clearError,
}: LoginPanelProps) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1.5">Bienvenido de vuelta</h1>
        <p className="text-sm text-slate-500">Ingresa tus credenciales para acceder al sistema</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Correo electrónico" htmlFor="login-email">
          <InputWithIcon icon={<Mail className="h-4 w-4" />}>
            <input
              id="login-email" type="email" autoComplete="email"
              value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }}
              placeholder="correo@clinica.com" disabled={isLoading}
              className={inputClass}
            />
          </InputWithIcon>
        </Field>

        <Field label="Contraseña" htmlFor="login-password">
          <InputWithIcon icon={<Lock className="h-4 w-4" />} right={
            <EyeToggle show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
          }>
            <input
              id="login-password" type={showPwd ? 'text' : 'password'} autoComplete="current-password"
              value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }}
              placeholder="••••••••" disabled={isLoading}
              className={`${inputClass} pr-10`}
            />
          </InputWithIcon>
        </Field>

        {formError && <ErrorAlert message={formError} />}

        <button type="submit" disabled={isLoading} className={primaryBtn}>
          {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Ingresar
        </button>
      </form>

      <Divider />

      <GoogleBtn onClick={onGoogle} loading={googleLoading} disabled={isLoading} />

      <p className="text-xs text-slate-500 text-center mt-6">
        ¿No tienes cuenta?{' '}
        <button onClick={onSwitch} className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          Regístrate
        </button>
      </p>
    </>
  );
}

interface RegisterPanelProps {
  email: string;       setEmail: (v: string) => void;
  password: string;    setPassword: (v: string) => void;
  confirm: string;     setConfirm: (v: string) => void;
  showPwd: boolean;    setShowPwd: (v: boolean) => void;
  showConfirm: boolean; setShowConfirm: (v: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onGoogle: () => void;
  onSwitch: () => void;
  isLoading: boolean;
  submitLoading: boolean;
  googleLoading: boolean;
  formError: string | null;
  clearError: () => void;
}

function RegisterPanel({
  email, setEmail, password, setPassword, confirm, setConfirm,
  showPwd, setShowPwd, showConfirm, setShowConfirm,
  onSubmit, onGoogle, onSwitch,
  isLoading, submitLoading, googleLoading, formError, clearError,
}: RegisterPanelProps) {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1.5">Crear cuenta</h1>
        <p className="text-sm text-slate-500">Completa los datos para registrarte en el sistema</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        <Field label="Correo electrónico" htmlFor="reg-email">
          <InputWithIcon icon={<Mail className="h-4 w-4" />}>
            <input
              id="reg-email" type="email" autoComplete="email"
              value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }}
              placeholder="correo@clinica.com" disabled={isLoading}
              className={inputClass}
            />
          </InputWithIcon>
        </Field>

        <Field label="Contraseña" htmlFor="reg-password">
          <InputWithIcon icon={<Lock className="h-4 w-4" />} right={
            <EyeToggle show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
          }>
            <input
              id="reg-password" type={showPwd ? 'text' : 'password'} autoComplete="new-password"
              value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }}
              placeholder="Mínimo 6 caracteres" disabled={isLoading}
              className={`${inputClass} pr-10`}
            />
          </InputWithIcon>
        </Field>

        <Field label="Confirmar contraseña" htmlFor="reg-confirm">
          <InputWithIcon icon={<Lock className="h-4 w-4" />} right={
            <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
          }>
            <input
              id="reg-confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
              value={confirm} onChange={(e) => { setConfirm(e.target.value); clearError(); }}
              placeholder="Repite tu contraseña" disabled={isLoading}
              className={`${inputClass} pr-10`}
            />
          </InputWithIcon>
        </Field>

        {formError && <ErrorAlert message={formError} />}

        <button type="submit" disabled={isLoading} className={primaryBtn}>
          {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear cuenta
        </button>
      </form>

      <Divider />

      <GoogleBtn onClick={onGoogle} loading={googleLoading} disabled={isLoading} label="Registrarse con Google" />

      <p className="text-xs text-slate-500 text-center mt-6">
        ¿Ya tienes cuenta?{' '}
        <button onClick={onSwitch} className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          Inicia sesión
        </button>
      </p>
    </>
  );
}

/* ══════════════════════════════════════════════════
   Primitivos de UI compartidos
══════════════════════════════════════════════════ */

const inputClass =
  'w-full h-10 pl-9 pr-4 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all disabled:opacity-50';

const primaryBtn =
  'w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function InputWithIcon({
  icon, right, children,
}: { icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</div>
      {children}
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle} tabIndex={-1}
      aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      className="text-slate-400 hover:text-slate-600 transition-colors"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs">
      <svg className="h-3.5 w-3.5 flex-none" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-xs text-slate-400 font-semibold">o continúa con</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

function GoogleBtn({
  onClick, loading, disabled, label = 'Continuar con Google',
}: { onClick: () => void; loading: boolean; disabled: boolean; label?: string }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="w-full h-10 flex items-center justify-center gap-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <GoogleIcon />}
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════
   Íconos SVG
══════════════════════════════════════════════════ */

function ToothIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3C9.2 3 6.5 4.6 5.8 7.2C5.1 9.8 5.8 12.8 7 15.2L8.5 20C8.8 21.1 9.8 21.5 10.7 21.1C11.3 20.8 11.4 20 11.7 19.8C11.9 19.7 12.1 19.7 12.3 19.8C12.6 20 12.7 20.8 13.3 21.1C14.2 21.5 15.2 21.1 15.5 20L17 15.2C18.2 12.8 18.9 9.8 18.2 7.2C17.5 4.6 14.8 3 12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
