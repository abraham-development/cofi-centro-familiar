/** Mensajes de Supabase Auth traducidos; nunca se muestran errores crudos. */
export function authErrorMessage(error: { message?: string; code?: string; status?: number } | null): string {
  if (!error) return "";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (code === "email_not_confirmed") return "Confirma tu correo antes de iniciar sesión.";
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.";
  }
  if (code === "weak_password" || message.includes("password")) {
    return "La contraseña es demasiado débil. Usa al menos 8 caracteres.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  if (code === "same_password") return "La nueva contraseña debe ser distinta de la anterior.";
  if (message.includes("fetch")) return "Sin conexión. Revisa tu red e inténtalo de nuevo.";
  return "No pudimos completar la operación. Inténtalo de nuevo.";
}
