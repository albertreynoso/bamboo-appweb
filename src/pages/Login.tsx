import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import LoadingTransition from '@/components/ui/LoadingTransition';

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
  const { user, loading, signInWithEmailPassword, signUpWithEmailPassword } = useAuthContext();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const isExpired = searchParams.get('reason') === 'expired';

  // ── Modo actual
  const [mode, setMode] = useState<Mode>('login');
  const [panelVisible, setPanelVisible] = useState(true);

  // ── Campos login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // ── Campos registro
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // ── Estados de carga y error
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);


  useEffect(() => {
    // Recuperar último email
    const savedEmail = localStorage.getItem('last_login_email');
    if (savedEmail) {
      setLoginEmail(savedEmail);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingTransition variant="premium_glass" message="Iniciando sesión..." />;
  }

  const isLoading = submitLoading;

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
      // Guardar email para la próxima vez
      localStorage.setItem('last_login_email', loginEmail.trim());
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

  // ── Google (removido)

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ══════════════════════════════════════
          LEFT — Panel de formulario
      ══════════════════════════════════════ */}
      <div className="w-full md:w-[45%] bg-white flex flex-col justify-between px-10 lg:px-16 py-10 overflow-y-auto">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-none">
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
              email={loginEmail} setEmail={setLoginEmail}
              password={loginPassword} setPassword={setLoginPassword}
              showPwd={showLoginPwd} setShowPwd={setShowLoginPwd}
              onSubmit={handleLogin}
              onSwitch={() => switchMode('register')}
              isLoading={isLoading}
              submitLoading={submitLoading}
              formError={formError}
              clearError={() => setFormError(null)}
              isExpired={isExpired}
            />
          ) : (
            <RegisterPanel
              email={regEmail} setEmail={setRegEmail}
              password={regPassword} setPassword={setRegPassword}
              confirm={regConfirm} setConfirm={setRegConfirm}
              showPwd={showRegPwd} setShowPwd={setShowRegPwd}
              showConfirm={showRegConfirm} setShowConfirm={setShowRegConfirm}
              onSubmit={handleRegister}
              onSwitch={() => switchMode('login')}
              isLoading={isLoading}
              submitLoading={submitLoading}
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
          RIGHT — Panel de marca (estático con imagen)
      ══════════════════════════════════════ */}
      <div className="hidden md:flex flex-1 relative overflow-hidden bg-slate-900">

        {/* Imagen de fondo (Full Bleed) */}
        <div
          className="absolute inset-0 z-0 transition-transform duration-1000 hover:scale-105"
          style={{
            // PON AQUÍ TU IMAGEN: Reemplaza esta URL de Unsplash por la ruta a tu foto de equipo (Ej: '/foto-equipo.jpg' si está en la carpeta public)
            backgroundImage: "url('/equipo-bamboo-2.jpeg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Capas de Overlay (Más claras y transparentes) */}
        <div className="absolute inset-0 bg-primary/25 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20 z-10" />

        {/* Contenido — Branding en esquina inferior izquierda */}
        <div className="relative z-20 w-full h-full flex flex-col items-start justify-end p-12 text-white">

          <div className="flex flex-col items-start animate-in slide-in-from-left-8 fade-in duration-700">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-6 shadow-2xl">
              <ToothIcon className="w-8 h-8 text-white" />
            </div>

            <div className="space-y-0.5">
              <h1 className="text-4xl font-light tracking-[0.25em] uppercase text-white drop-shadow-xl">
                Bambú
              </h1>
              <div className="flex items-center gap-3">
                <div className="w-8 h-px bg-white/40" />
                <p className="text-xs tracking-[0.4em] uppercase text-white/80 font-medium">
                  Estética Dental
                </p>
              </div>
            </div>
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
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPwd: boolean; setShowPwd: (v: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onSwitch: () => void;
  isLoading: boolean;
  submitLoading: boolean;
  formError: string | null;
  clearError: () => void;
  isExpired: boolean;
}

function LoginPanel({
  email, setEmail, password, setPassword, showPwd, setShowPwd,
  onSubmit, onSwitch,
  isLoading, submitLoading, formError, clearError, isExpired,
}: LoginPanelProps) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1.5">Bienvenido de vuelta</h1>
        <p className="text-sm text-slate-500">Ingresa tus credenciales para acceder al sistema</p>
      </div>

      {isExpired && (
        <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-center gap-3 text-amber-700 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="h-4 w-4 flex-none" />
          <p className="text-xs font-medium">Tu sesión ha expirado por inactividad. Por favor, ingresa de nuevo.</p>
        </div>
      )}

      <form autoComplete="off" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Correo electrónico" htmlFor="login-email">
          <InputWithIcon icon={<Mail className="h-4 w-4" />}>
            <input
              id="login-email" type="email" autoComplete="off"
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
              id="login-password" type={showPwd ? 'text' : 'password'} autoComplete="off"
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

      <p className="text-xs text-slate-500 text-center mt-6">
        ¿No tienes cuenta?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Regístrate
        </button>
      </p>
    </>
  );
}

interface RegisterPanelProps {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  confirm: string; setConfirm: (v: string) => void;
  showPwd: boolean; setShowPwd: (v: boolean) => void;
  showConfirm: boolean; setShowConfirm: (v: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onSwitch: () => void;
  isLoading: boolean;
  submitLoading: boolean;
  formError: string | null;
  clearError: () => void;
}

function RegisterPanel({
  email, setEmail, password, setPassword, confirm, setConfirm,
  showPwd, setShowPwd, showConfirm, setShowConfirm,
  onSubmit, onSwitch,
  isLoading, submitLoading, formError, clearError,
}: RegisterPanelProps) {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1.5">Crear cuenta</h1>
        <p className="text-sm text-slate-500">Completa los datos para registrarte en el sistema</p>
      </div>

      <form autoComplete="off" onSubmit={onSubmit} className="space-y-3.5" noValidate>
        <Field label="Correo electrónico" htmlFor="reg-email">
          <InputWithIcon icon={<Mail className="h-4 w-4" />}>
            <input
              id="reg-email" type="email" autoComplete="off"
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
              id="reg-password" type={showPwd ? 'text' : 'password'} autoComplete="off"
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
              id="reg-confirm" type={showConfirm ? 'text' : 'password'} autoComplete="off"
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

      <p className="text-xs text-slate-500 text-center mt-6">
        ¿Ya tienes cuenta?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-primary hover:text-primary/80 transition-colors">
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
  'w-full h-10 pl-9 pr-4 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50';

const primaryBtn =
  'w-full h-10 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

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

// [REMOVED Divider and GoogleBtn]

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

// [REMOVED GoogleIcon]
