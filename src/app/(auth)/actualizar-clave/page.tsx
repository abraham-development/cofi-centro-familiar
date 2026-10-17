import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { UpdatePasswordForm } from "@/features/auth/update-password-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nueva contraseña" };

async function Guard() {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) redirect("/recuperar");
  return <UpdatePasswordForm />;
}

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <Guard />
    </Suspense>
  );
}
