import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="m-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">No encontramos esta página</h1>
      <p className="text-lg text-muted-foreground">Puede que no exista o que no tengas acceso a ella.</p>
      <Button size="lg" nativeButton={false} render={<Link href="/" />}>
        Ir al inicio
      </Button>
    </main>
  );
}
