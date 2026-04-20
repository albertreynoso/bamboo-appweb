interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[calc(100vh-6rem)] w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
