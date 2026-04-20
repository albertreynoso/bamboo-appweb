// src/components/employees/DocumentoUploadDialog.tsx
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { subirDocumento } from "@/services/documentosService";
import { FileText, ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivityLog } from "@/hooks/useActivityLog";

const TIPOS_ACEPTADOS = ".pdf,.png,.jpg,.jpeg";
const MAX_MB = 10;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empleadoId: string;
  onSuccess: () => void;
}

export default function DocumentoUploadDialog({
  open,
  onOpenChange,
  empleadoId,
  onSuccess,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { log } = useActivityLog();

  const resetForm = () => {
    setTitulo("");
    setDescripcion("");
    setArchivo(null);
    setProgreso(0);
    setError(null);
  };

  const handleClose = () => {
    if (subiendo) return;
    resetForm();
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext ?? "")) {
      setError("Formato no permitido. Usa PDF, PNG, JPG o JPEG.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setArchivo(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const input = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(input);
    }
  };

  const handleSubmit = async () => {
    if (!titulo.trim() || !archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      await subirDocumento(empleadoId, archivo, titulo.trim(), descripcion.trim(), setProgreso);
      log({ modulo: "Documentos", accion: "subió", entidad: "documento", entidad_id: empleadoId, entidad_nombre: titulo.trim() });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Error al subir el documento. Inténtalo de nuevo.");
    } finally {
      setSubiendo(false);
      setProgreso(0);
    }
  };

  const esPDF = archivo?.type === "application/pdf";
  const esImagen = archivo && !esPDF;
  const previewURL = esImagen ? URL.createObjectURL(archivo) : null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Subir documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="titulo" className="text-sm font-medium">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="titulo"
              placeholder="Ej: Contrato de trabajo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={subiendo}
              maxLength={80}
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="descripcion" className="text-sm font-medium">
              Descripción
              <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Breve descripción del documento..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={subiendo}
              rows={2}
              maxLength={200}
              className="resize-none"
            />
          </div>

          {/* Dropzone */}
          {!archivo ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border/60 rounded-xl p-6 flex flex-col items-center gap-2 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Arrastra un archivo o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PDF, PNG, JPG, JPEG · máx. {MAX_MB} MB
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={TIPOS_ACEPTADOS}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            /* Vista previa del archivo seleccionado */
            <div className="border border-border/60 rounded-xl overflow-hidden">
              {esImagen && previewURL ? (
                <img
                  src={previewURL}
                  alt="Preview"
                  className="w-full h-36 object-cover"
                />
              ) : (
                <div className="h-20 bg-red-50 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-red-400" />
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
                <div className="flex items-center gap-2 min-w-0">
                  {esPDF
                    ? <FileText className="h-4 w-4 text-red-500 shrink-0" />
                    : <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{archivo.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(archivo.size)}</p>
                  </div>
                </div>
                {!subiendo && (
                  <button
                    onClick={() => { setArchivo(null); setError(null); }}
                    className="ml-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Progreso */}
          {subiendo && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Subiendo...</span>
                <span>{progreso}%</span>
              </div>
              <Progress value={progreso} className="h-1.5" />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive font-medium">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={subiendo}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!titulo.trim() || !archivo || subiendo}
            className="gap-1.5"
          >
            {subiendo
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Subiendo...</>
              : <><Upload className="h-3.5 w-3.5" />Subir documento</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
