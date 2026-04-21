import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  CreditCard,
  UserCheck,
  Menu,
  X,
  LogOut,
  Settings2,
  UserCog,
  Ellipsis,
  Package,
  History,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuthContext } from "@/context/AuthContext";
import type { User } from "firebase/auth";

interface LayoutProps {
  children: ReactNode;
}

const ALL_MENU_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",     path: "/",             roles: ["admin"] },
  { icon: Calendar,        label: "Calendario",    path: "/calendario",   roles: ["admin", "recepcionista"] },
  { icon: UserCircle,      label: "Pacientes",     path: "/pacientes",    roles: ["admin", "recepcionista"] },
  { icon: CreditCard,      label: "Pagos",         path: "/pagos",        roles: ["admin", "recepcionista"] },
  { icon: Package,         label: "Inventario",    path: "/inventario",   roles: ["admin"] },
  { icon: Users,           label: "Empleados",     path: "/empleados",    roles: ["admin"] },
  { icon: UserCheck,       label: "Usuarios",      path: "/usuarios",     roles: ["admin"] },
  { icon: Settings2,       label: "Configuración", path: "/configuracion",roles: ["admin"] },
  { icon: History,         label: "Actividad",     path: "/actividad",    roles: ["admin"] },
] as const;

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut, user, userProfile, rol } = useAuthContext();
  const menuItems = ALL_MENU_ITEMS.filter(item => rol ? item.roles.includes(rol) : false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
        <h1 className="ml-4 text-xl font-bold text-sidebar-foreground"></h1>
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="px-4 py-2 flex justify-start">
          <img
            src={`${import.meta.env.BASE_URL}logo-bamboo-verde.svg`}
            alt="Logo Bamboo"
            className="w-full h-auto max-w-[180px] object-contain brightness-0 invert"
          />
        </div>

        <nav className="px-3 space-y-1 flex flex-col h-[calc(100vh-120px)]">
          <div className="flex-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-lg transition-all
                    ${isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User menu */}
          <div className="border-t border-sidebar-border pt-4 pb-4 px-3 flex flex-col gap-2">
            {user && (
              <UserMenu
                user={user}
                userProfile={userProfile}
                onSignOut={signOut}
              />
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   UserMenu — componente de usuario
───────────────────────────────────────── */

function getInitials(user: User): string {
  if (user.displayName) {
    const parts = user.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return (user.email?.[0] ?? "U").toUpperCase();
}

function UserAvatar({
  user,
  size = "sm",
  variant = "sidebar",
}: {
  user: User;
  size?: "sm" | "md";
  variant?: "sidebar" | "menu";
}) {
  const initials = getInitials(user);
  const dim = size === "md" ? "w-10 h-10 text-sm" : "w-9 h-9 text-xs";

  const ringClass =
    variant === "sidebar" ? "ring-2 ring-white/25" : "ring-1 ring-border";

  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt="Avatar"
        referrerPolicy="no-referrer"
        className={`${dim} rounded-lg object-cover ${ringClass} flex-none`}
      />
    );
  }

  const bgClass =
    variant === "sidebar"
      ? "bg-white/15 text-white"
      : "bg-primary/10 text-primary";

  return (
    <div
      className={`${dim} rounded-lg ${bgClass} ${ringClass} flex items-center justify-center flex-none font-semibold`}
    >
      {initials}
    </div>
  );
}

function UserMenu({
  user,
  userProfile,
  onSignOut,
}: {
  user: User;
  userProfile?: any;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  const rawName = userProfile?.nombre || user.displayName || user.email?.split("@")[0] || "Usuario";
  const role = userProfile?.rol || "Administrador";

  return (
    <div className="flex flex-col gap-2 w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="group flex items-center gap-3 p-2 rounded-xl transition-all duration-200 outline-none w-full hover:bg-white/5 active:bg-white/10">
            <UserAvatar user={user} size="sm" />

            <div className="flex-1 min-w-0 text-left">
              <p className="font-bold text-sidebar-foreground truncate leading-tight text-[13px]">
                {rawName}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate font-medium uppercase tracking-wider mt-0.5">
                {role}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={12}
          className="w-64 p-0 overflow-hidden shadow-2xl border-white/10"
        >
          {/* Header con info del usuario */}
          <div className="flex items-center gap-3 px-4 py-4 bg-muted/40 border-b border-border/50">
            <UserAvatar user={user} size="md" variant="menu" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight truncate">
                {rawName}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight mt-1 opacity-80">
                {user.email}
              </p>
            </div>
          </div>

          <div className="p-1.5">
            <DropdownMenuItem
              onClick={() => navigate("/perfil")}
              className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer rounded-lg hover:bg-primary/5 focus:bg-primary/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <UserCircle className="h-4 w-4" />
              </div>
              <span className="font-medium">Gestión de perfil</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onSignOut}
              className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer rounded-lg hover:bg-destructive/10 focus:bg-destructive/10 text-destructive transition-colors mt-1"
            >
              <div className="w-8 h-8 rounded-md bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-4 w-4" />
              </div>
              <span className="font-medium">Cerrar sesión</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
