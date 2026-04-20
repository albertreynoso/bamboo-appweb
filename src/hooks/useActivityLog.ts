import { useCallback } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { registrarLog } from "@/services/activityLogService";
import type { LogParams } from "@/types/activityLog";

/** Devuelve solo el primer nombre y el primer apellido */
function trimName(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : name.trim();
}

export function useActivityLog() {
  const { user, userProfile, rol } = useAuthContext();

  const log = useCallback(
    async (params: LogParams) => {
      const nombre = trimName(
        userProfile
          ? `${userProfile.nombre} ${userProfile.apellidoPaterno}`
          : (user?.email ?? "Usuario desconocido")
      );

      const paciente = trimName(params.paciente_nombre);
      const entidadDesc = params.entidad_nombre ?? params.entidad;
      const pacienteDesc = paciente && paciente !== entidadDesc ? ` — ${paciente}` : "";
      const mensaje = `El usuario ${nombre} ${params.accion} ${entidadDesc}${pacienteDesc}`;

      await registrarLog({
        usuario_uid: user?.uid ?? "",
        usuario_nombre: nombre,
        usuario_rol: rol ?? "desconocido",
        modulo: params.modulo,
        accion: params.accion,
        entidad: params.entidad,
        entidad_id: params.entidad_id,
        entidad_nombre: params.entidad_nombre,
        paciente_nombre: paciente || undefined,
        mensaje,
        cambios: params.cambios,
      });
    },
    [user, userProfile, rol]
  );

  return { log };
}
