import type { Metadata } from "next";
import { Suspense } from "react";

import { PairingScreen } from "@/features/devices/components/pairing-screen";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Vincular pantalla" };

async function Pairing({ searchParams }: { searchParams: PageProps<"/vincular">["searchParams"] }) {
  const params = await searchParams;
  const user = await getSessionUser();
  return <PairingScreen revoked={params.revocada === "1"} isAdult={Boolean(user && !user.isAnonymous)} />;
}

export default function PairPage(props: PageProps<"/vincular">) {
  return (
    <Suspense>
      <Pairing searchParams={props.searchParams} />
    </Suspense>
  );
}
