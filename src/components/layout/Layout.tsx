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

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard",   path: "/"           },
  { icon: Users,           label: "Empleados",   path: "/empleados"  },
  { icon: UserCircle,      label: "Pacientes",   path: "/pacientes"  },
  { icon: Calendar,        label: "Calendario",  path: "/calendario" },
  { icon: CreditCard,      label: "Pagos",       path: "/pagos"      },
  { icon: UserCheck,       label: "Usuarios",    path: "/usuarios"   },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut, user } = useAuthContext();

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
        <div className="p-6">
          <h1 className="text-2xl font-bold text-sidebar-foreground flex items-center gap-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold">D</span>
            </div>
            DentLink
          </h1>
          <h2 className="text-xl font-bold text-sidebar-foreground flex items-center gap-2">
            Bamboo
          </h2>
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
                    ${
                      isActive
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
          <div className="border-t border-sidebar-border pt-3 pb-2">
            {user && <UserMenu user={user} onSignOut={signOut} />}
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

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const navigate = useNavigate();
  const displayName = user.displayName || user.email?.split("@")[0] || "Usuario";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <UserAvatar user={user} />

          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-white leading-tight truncate">
              {displayName}
            </p>
            <p className="text-xs text-white/45 truncate leading-tight mt-0.5">
              {user.email}
            </p>
          </div>

          <Ellipsis className="h-4 w-4 text-white/35 flex-none group-hover:text-white/65 transition-colors" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-60 p-0 overflow-hidden"
      >
        {/* Header con info del usuario */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-muted/50 border-b border-border/60">
          <UserAvatar user={user} size="md" variant="menu" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
              {user.email}
            </p>
          </div>
        </div>

        {/* Opciones */}
        <div className="p-1">
          <DropdownMenuItem
            onClick={() => navigate("/usuarios")}
            className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-md"
          >
            <UserCog className="h-4 w-4 text-muted-foreground flex-none" />
            <span>Gestión de usuarios</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled
            className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md"
          >
            <Settings2 className="h-4 w-4 flex-none" />
            <span>Configuración</span>
            <span className="ml-auto text-[10px] font-semibold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Pronto
            </span>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="p-1">
          <DropdownMenuItem
            onClick={onSignOut}
            className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-md text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 flex-none" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
