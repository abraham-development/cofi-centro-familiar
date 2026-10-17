import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, familyQuery } = vi.hoisted(() => {
  const familyQuery = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(), single: vi.fn(),
  };
  const client = { auth: { getClaims: vi.fn() }, rpc: vi.fn(), from: vi.fn(() => familyQuery) };
  return { client, familyQuery };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createDeviceClient: async () => client }));

import { getDeviceContext } from "@/lib/auth/device";

beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "device-user", is_anonymous: true } } });
  client.rpc.mockResolvedValue({ data: [{ status: "paired", family_id: "family" }], error: null });
  // This is how PostgREST answers when RLS access disappears between reads.
  familyQuery.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
  familyQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("revocación durante la carga de una pantalla", () => {
  it("concluye la revocación si pierde acceso a la familia después de validar el vínculo", async () => {
    const context = await getDeviceContext();
    expect(context.status).toBe("revoked");
    expect(context).not.toHaveProperty("family");
    expect(context).not.toHaveProperty("device");
  });

  it("no presenta un error de red como si fuera una revocación", async () => {
    const error = new Error("Network unavailable");
    familyQuery.maybeSingle.mockResolvedValue({ data: null, error });
    await expect(getDeviceContext()).rejects.toThrow(error);
  });

  it("no carga información familiar si el vínculo ya está revocado", async () => {
    client.rpc.mockResolvedValue({ data: [{ status: "revoked" }], error: null });
    expect((await getDeviceContext()).status).toBe("revoked");
    expect(client.from).not.toHaveBeenCalled();
  });
});
