import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, User, ShieldCheck, Calendar, ChevronDown } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { saveUserProfile } from "@/services/usuariosService";
import { toast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
type Rol = "recepcionista" | "administrador";
type Genero = "Masculino" | "Femenino";

interface FormFields {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  genero: Genero | "";
  rol: Rol | "";
  dni: string;
  telefono: string;
  direccion: string;
}

interface FormErrors {
  nombre?: string;
  apellidoPaterno?: string;
  fechaNacimiento?: string;
  genero?: string;
  rol?: string;
  dni?: string;
  telefono?: string;
  direccion?: string;
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate(fields: FormFields): FormErrors {
  const errors: FormErrors = {};
  if (!fields.nombre.trim()) errors.nombre = "Campo requerido";
  if (!fields.apellidoPaterno.trim()) errors.apellidoPaterno = "Campo requerido";
  if (!fields.fechaNacimiento) {
    errors.fechaNacimiento = "Campo requerido";
  } else {
    const birth = new Date(fields.fechaNacimiento);
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 16);
    if (birth > minAge) errors.fechaNacimiento = "Debes tener al menos 16 años";
  }
  if (!fields.genero) errors.genero = "Selecciona tu género";
  if (!fields.rol) errors.rol = "Selecciona tu rol";
  if (!fields.dni.trim()) {
    errors.dni = "Campo requerido";
  } else if (!/^\d{8}$/.test(fields.dni)) {
    errors.dni = "El DNI debe tener 8 dígitos";
  }
  if (!fields.telefono.trim()) {
    errors.telefono = "Campo requerido";
  } else if (!/^\d{9}$/.test(fields.telefono)) {
    errors.telefono = "El teléfono debe tener 9 dígitos";
  }
  if (!fields.direccion.trim()) errors.direccion = "Campo requerido";
  return errors;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function onlyLetters(value: string) {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "");
}

function onlyDigits(value: string, maxLen: number) {
  return value.replace(/\D/g, "").slice(0, maxLen);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
          {title}
        </p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
}

const inputCls = (hasError?: boolean) =>
  `w-full h-10 px-3.5 text-sm border rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
    hasError
      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
      : "border-slate-200 focus:ring-blue-100 focus:border-blue-400"
  }`;

// ── Main component ────────────────────────────────────────────────────────────
export default function PerfilCompletar() {
  const { user, loading, profileComplete, refreshProfile } = useAuthContext();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [fields, setFields] = useState<FormFields>({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    genero: "",
    rol: "",
    dni: "",
    telefono: "",
    direccion: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Redirect guards
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profileComplete === true) navigate("/", { replace: true });
  }, [profileComplete, navigate]);

  if (loading || profileComplete === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const set = (key: keyof FormFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof FormErrors];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(fields);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    if (!user) return;
    setSaving(true);
    try {
      await saveUserProfile(user.uid, {
        nombre: fields.nombre.trim(),
        apellidoPaterno: fields.apellidoPaterno.trim(),
        apellidoMaterno: fields.apellidoMaterno.trim() || undefined,
        fechaNacimiento: fields.fechaNacimiento,
        genero: fields.genero as Genero,
        rol: fields.rol as Rol,
        dni: fields.dni,
        telefono: fields.telefono,
        direccion: fields.direccion.trim(),
      });
      await refreshProfile();
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({
        title: "Error al guardar",
        description: err.message || "No se pudo guardar el perfil. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200/70 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-none">
            <ToothIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 tracking-tight">
            DentLink
          </span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-lg space-y-6">
          {/* Intro */}
          <div>
            <h1 className="text-xl font-semibold text-slate-900 mb-1">
              Completa tu perfil
            </h1>
            <p className="text-sm text-slate-500">
              Necesitamos algunos datos antes de que puedas acceder al sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* ── Rol ── */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
                Tipo de acceso
              </p>
              {errors.rol && (
                <p className="text-[11px] text-red-500 font-medium">
                  {errors.rol}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <RolCard
                  value="recepcionista"
                  selected={fields.rol === "recepcionista"}
                  icon={<User className="h-5 w-5" />}
                  title="Recepcionista"
                  description="Gestiona citas y atención al paciente"
                  onClick={() => set("rol", "recepcionista")}
                />
                <RolCard
                  value="administrador"
                  selected={fields.rol === "administrador"}
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Administrador"
                  description="Acceso completo al sistema"
                  onClick={() => set("rol", "administrador")}
                />
              </div>
            </div>

            {/* ── Información personal ── */}
            <SectionCard title="Información personal">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre(s)" error={errors.nombre}>
                  <input
                    type="text"
                    value={fields.nombre}
                    onChange={(e) => set("nombre", onlyLetters(e.target.value))}
                    placeholder="Juan"
                    className={inputCls(!!errors.nombre)}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Apellido paterno" error={errors.apellidoPaterno}>
                  <input
                    type="text"
                    value={fields.apellidoPaterno}
                    onChange={(e) =>
                      set("apellidoPaterno", onlyLetters(e.target.value))
                    }
                    placeholder="García"
                    className={inputCls(!!errors.apellidoPaterno)}
                    autoComplete="family-name"
                  />
                </Field>
              </div>

              <Field label="Apellido materno (opcional)">
                <input
                  type="text"
                  value={fields.apellidoMaterno}
                  onChange={(e) =>
                    set("apellidoMaterno", onlyLetters(e.target.value))
                  }
                  placeholder="López"
                  className={inputCls()}
                  autoComplete="additional-name"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Fecha de nacimiento" error={errors.fechaNacimiento}>
                  <div className="relative">
                    <input
                      type="date"
                      value={fields.fechaNacimiento}
                      onChange={(e) => set("fechaNacimiento", e.target.value)}
                      max={(() => {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() - 16);
                        return d.toISOString().split("T")[0];
                      })()}
                      className={`${inputCls(!!errors.fechaNacimiento)} pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </Field>

                <Field label="Género" error={errors.genero}>
                  <div className="relative">
                    <select
                      value={fields.genero}
                      onChange={(e) => set("genero", e.target.value)}
                      className={`${inputCls(!!errors.genero)} appearance-none pr-9`}
                    >
                      <option value="">Seleccionar</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </Field>
              </div>
            </SectionCard>

            {/* ── Contacto ── */}
            <SectionCard title="Contacto">
              <div className="grid grid-cols-2 gap-4">
                <Field label="DNI" error={errors.dni}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fields.dni}
                    onChange={(e) => set("dni", onlyDigits(e.target.value, 8))}
                    placeholder="12345678"
                    className={inputCls(!!errors.dni)}
                    maxLength={8}
                  />
                </Field>
                <Field label="Teléfono" error={errors.telefono}>
                  <input
                    type="text"
                    inputMode="tel"
                    value={fields.telefono}
                    onChange={(e) =>
                      set("telefono", onlyDigits(e.target.value, 9))
                    }
                    placeholder="987654321"
                    className={inputCls(!!errors.telefono)}
                    maxLength={9}
                  />
                </Field>
              </div>

              <Field label="Dirección" error={errors.direccion}>
                <input
                  type="text"
                  value={fields.direccion}
                  onChange={(e) => set("direccion", e.target.value)}
                  placeholder="Av. Ejemplo 123, Lima"
                  className={inputCls(!!errors.direccion)}
                  autoComplete="street-address"
                />
              </Field>
            </SectionCard>

            {/* ── Save ── */}
            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar y continuar"
              )}
            </button>
          </form>

          {/* Email hint */}
          {user?.email && (
            <p className="text-center text-xs text-slate-400 pb-4">
              Sesión iniciada como{" "}
              <span className="font-medium text-slate-500">{user.email}</span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Role card ─────────────────────────────────────────────────────────────────
function RolCard({
  selected,
  icon,
  title,
  description,
  onClick,
}: {
  value: Rol;
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2.5 p-4 rounded-2xl border-2 text-left transition-all ${
        selected
          ? "border-blue-500 bg-blue-50/70 shadow-sm shadow-blue-100"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div
        className={`p-2 rounded-xl transition-colors ${
          selected
            ? "bg-blue-100 text-blue-600"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </div>
      <div>
        <p
          className={`text-sm font-semibold transition-colors ${
            selected ? "text-blue-700" : "text-slate-800"
          }`}
        >
          {title}
        </p>
        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
          {description}
        </p>
      </div>
    </button>
  );
}

// ── Tooth icon ────────────────────────────────────────────────────────────────
function ToothIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3C9.2 3 6.5 4.6 5.8 7.2C5.1 9.8 5.8 12.8 7 15.2L8.5 20C8.8 21.1 9.8 21.5 10.7 21.1C11.3 20.8 11.4 20 11.7 19.8C11.9 19.7 12.1 19.7 12.3 19.8C12.6 20 12.7 20.8 13.3 21.1C14.2 21.5 15.2 21.1 15.5 20L17 15.2C18.2 12.8 18.9 9.8 18.2 7.2C17.5 4.6 14.8 3 12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}
