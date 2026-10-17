import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Brand size="lg" />
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Tu información familiar es privada: solo la ven los adultos y las pantallas que tú autorices.
      </p>
    </main>
  );
}
