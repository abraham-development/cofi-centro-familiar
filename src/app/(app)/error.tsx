"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">No pudimos cargar esta pantalla</h1>
      <p className="text-lg text-muted-foreground">
        Puede ser un problema de conexión. Tus datos están guardados; vuelve a intentarlo.
      </p>
      <Button size="lg" onClick={reset}>
        <RefreshCw aria-hidden /> Reintentar
      </Button>
    </div>
  );
}
