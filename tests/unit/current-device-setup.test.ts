import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(), deviceContext: vi.fn(), deleteCookie: vi.fn(),
  adult: { rpc: vi.fn(), auth: { signOut: vi.fn() } },
  device: { rpc: vi.fn(), auth: { getClaims: vi.fn(), signOut: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: mocks.deleteCookie }) }));
vi.mock("@/lib/auth/session", () => ({ getAdultContext: mocks.context, ACTIVE_FAMILY_COOKIE: "cofi-family" }));
vi.mock("@/lib/auth/device", () => ({ getDeviceContext: mocks.deviceContext }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.adult, createDeviceClient: async () => mocks.device }));

import { activateCurrentDeviceAction, finishCurrentDeviceSetupAction } from "@/features/devices/actions";
import { DomainError } from "@/lib/errors";

const familyId = "10000000-0000-4000-8000-000000000001";
const otherFamilyId = "10000000-0000-4000-8000-000000000002";
const deviceId = "20000000-0000-4000-8000-000000000001";
const input = { expectedFamilyId: familyId, name: "Pantalla familiar", scope: "home", memberId: null };
const linked = { status: "paired", device_id: deviceId, family_id: familyId, device_name: input.name, scope: "home", member_id: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ family: { id: familyId }, membership: { role: "owner" }, supabase: mocks.adult });
  mocks.device.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "anonymous-device", is_anonymous: true } }, error: null });
  let reads = 0;
  mocks.device.rpc.mockImplementation(async (method: string) => {
    if (method === "request_device_pairing") return { data: [{ code: "ABCD-EFGH" }], error: null };
    return { data: [reads++ === 0 ? { status: "none" } : linked], error: null };
  });
  mocks.adult.rpc.mockResolvedValue({ data: [{ ok: true, device_id: deviceId }], error: null });
  mocks.adult.auth.signOut.mockResolvedValue({ error: null });
  mocks.deviceContext.mockResolvedValue({ status: "paired", device: { id: deviceId } });
});

describe("activar el navegador actual", () => {
  it("exige una pertenencia adulta antes de usar la sesión del dispositivo", async () => {
    mocks.context.mockResolvedValue(null);
    expect(await activateCurrentDeviceAction(input)).toMatchObject({ ok: false, error: { code: "SESSION_REQUIRED" } });
    expect(mocks.device.auth.getClaims).not.toHaveBeenCalled();
  });

  it("rechaza una familia distinta de la confirmada en el formulario", async () => {
    expect(await activateCurrentDeviceAction({ ...input, expectedFamilyId: otherFamilyId })).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    expect(mocks.adult.rpc).not.toHaveBeenCalled();
  });

  it("no utiliza una identidad adulta como identidad de pantalla", async () => {
    mocks.device.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "adult", is_anonymous: false } } });
    expect(await activateCurrentDeviceAction(input)).toMatchObject({ ok: false });
    expect(mocks.device.rpc).not.toHaveBeenCalled();
  });

  it("vincula con las identidades de las cookies y mantiene el código solo en el servidor", async () => {
    const result = await activateCurrentDeviceAction({ ...input, authUserId: "untrusted", familyId: otherFamilyId });
    expect(result).toEqual({ ok: true, data: { deviceId } });
    expect(JSON.stringify(result)).not.toContain("ABCD");
    expect(mocks.adult.rpc).toHaveBeenCalledWith("approve_device_pairing", expect.objectContaining({ p_code: "ABCD-EFGH", p_family_id: familyId, p_scope: "home", p_member_id: null }));
    expect(mocks.adult.auth.signOut).not.toHaveBeenCalled();
  });

  it("un reintento tras perder la respuesta recupera el vínculo sin crear otro", async () => {
    mocks.device.rpc.mockResolvedValue({ data: [linked], error: null });
    expect(await activateCurrentDeviceAction(input)).toEqual({ ok: true, data: { deviceId } });
    expect(mocks.device.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.adult.rpc).not.toHaveBeenCalled();
  });

  it("no cambia un vínculo previo aunque el cliente pida otro alcance", async () => {
    mocks.device.rpc.mockResolvedValue({ data: [{ ...linked, family_id: otherFamilyId }], error: null });
    expect(await activateCurrentDeviceAction(input)).toMatchObject({ ok: false, error: { code: "ALREADY_APPLIED" } });
    expect(mocks.adult.rpc).not.toHaveBeenCalled();
  });

  it("exige elegir hijo y respeta el rechazo de un hijo de otra familia", async () => {
    expect(await activateCurrentDeviceAction({ ...input, scope: "child" })).toMatchObject({ ok: false, error: { code: "INVALID" } });
    expect(mocks.adult.rpc).not.toHaveBeenCalled();
    mocks.adult.rpc.mockResolvedValue({ data: [{ ok: false, error_code: "INVALID" }], error: null });
    expect(await activateCurrentDeviceAction({ ...input, scope: "child", memberId: otherFamilyId })).toMatchObject({ ok: false, error: { code: "INVALID" } });
    expect(mocks.adult.auth.signOut).not.toHaveBeenCalled();
  });

  it("no confirma éxito si la comprobación final corresponde a otra familia", async () => {
    mocks.device.rpc.mockResolvedValueOnce({ data: [{ status: "none" }], error: null })
      .mockResolvedValueOnce({ data: [{ code: "ABCD-EFGH" }], error: null })
      .mockResolvedValueOnce({ data: [{ ...linked, family_id: otherFamilyId }], error: null });
    expect(await activateCurrentDeviceAction(input)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("terminar activación", () => {
  it("no cierra al adulto si la pantalla fue revocada o no coincide", async () => {
    mocks.deviceContext.mockResolvedValueOnce({ status: "revoked" });
    expect(await finishCurrentDeviceSetupAction(deviceId)).toMatchObject({ ok: false });
    expect(await finishCurrentDeviceSetupAction(otherFamilyId)).toMatchObject({ ok: false });
    expect(mocks.adult.auth.signOut).not.toHaveBeenCalled();
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
  });

  it("conserva la sesión de pantalla y cierra solo la sesión adulta local", async () => {
    expect(await finishCurrentDeviceSetupAction(deviceId)).toEqual({ ok: true, data: undefined });
    expect(mocks.adult.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.deleteCookie).toHaveBeenCalledWith("cofi-family");
    expect(mocks.device.auth.signOut).not.toHaveBeenCalled();
  });

  it("permite reintentar el cierre sin generar solicitudes de vinculación", async () => {
    mocks.adult.auth.signOut.mockResolvedValueOnce({ error: new DomainError("OFFLINE") });
    expect(await finishCurrentDeviceSetupAction(deviceId)).toMatchObject({ ok: false, error: { code: "OFFLINE" } });
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
    expect(await finishCurrentDeviceSetupAction(deviceId)).toMatchObject({ ok: true });
    expect(mocks.device.rpc).not.toHaveBeenCalled();
    expect(mocks.adult.rpc).not.toHaveBeenCalled();
  });
});
