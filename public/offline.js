/* Standalone public shell: textContent only, no framework or authenticated fetches. */
(() => {
  const requestedMode = new URLSearchParams(location.search).get("mode");
  let homeDevice = false;
  try { homeDevice = location.pathname === "/" && !localStorage.getItem("cofi-snapshot-v1:adult") && !!localStorage.getItem("cofi-snapshot-v1:device"); } catch { /* No storage. */ }
  const mode = location.pathname === "/pantalla" || requestedMode === "device" || (requestedMode !== "adult" && homeDevice) ? "device" : "adult";
  const key = `cofi-snapshot-v1:${mode}`;
  const ttl = 24 * 3600_000;
  const $ = (id) => document.getElementById(id);
  const retry = mode === "device" ? "/pantalla" : "/casa";
  $("retry").href = retry;
  let snapshot;
  try { snapshot = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* No usable storage. */ }

  function valid(s) {
    return s && s.version === 1 && s.actor === mode && typeof s.identity === "string" && typeof s.familyId === "string" &&
      typeof s.familyName === "string" && typeof s.label === "string" && ["12h", "24h"].includes(s.hourFormat) &&
      Number.isInteger(s.savedAt) && s.savedAt <= Date.now() && Number.isInteger(s.expiresAt) &&
      s.expiresAt > Date.now() && s.expiresAt - s.savedAt === ttl && typeof s.timezone === "string" &&
      Array.isArray(s.events) && s.events.every((e) => typeof e.title === "string" && typeof e.firstDay === "string" && typeof e.lastDay === "string" && Array.isArray(e.participants)) &&
      Array.isArray(s.tasks) && s.tasks.every((t) => typeof t.title === "string" && typeof t.status === "string");
  }
  function clear(remove = true) {
    try { if (remove) localStorage.removeItem(key); } catch { /* No storage. */ }
    snapshot = null;
    $("snapshot").hidden = true;
    // Clear data from the DOM as well as hiding it (expiry and cross-tab signout).
    ["family", "clock", "countdown", "today", "week", "tasks", "synced"].forEach((id) => $(id).replaceChildren());
    $("empty").hidden = false;
  }
  if (!valid(snapshot)) { clear(); return; }
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: snapshot.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  } catch { clear(); return; }
  // Only runs on the client; there is no server/client hydration here.
  function parts(instant) { return Object.fromEntries(formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value])); }
  function date(instant) { const p = parts(instant); return `${p.year}-${p.month}-${p.day}`; }
  function time(instant) {
    const p = parts(instant);
    return snapshot.hourFormat === "24h" ? `${p.hour}:${p.minute}` : `${Number(p.hour) % 12 || 12}:${p.minute} ${Number(p.hour) < 12 ? "AM" : "PM"}`;
  }
  function list(id, values) {
    const nodes = (values.length ? values : ["Sin elementos descargados"]).map((text) => {
      const li = document.createElement("li"); li.textContent = text; return li;
    });
    $(id).replaceChildren(...nodes);
  }
  let renderedDay;
  function render() {
    if (!valid(snapshot)) { clear(); return; }
    const now = Date.now();
    $("clock").textContent = time(now);
    const today = date(now);
    if (renderedDay !== today) {
      renderedDay = today;
      $("family").textContent = `${snapshot.familyName} · ${snapshot.label}`;
      $("synced").textContent = `Última sincronización: ${date(snapshot.savedAt)} a las ${time(snapshot.savedAt)}. Caduca: ${date(snapshot.expiresAt)} a las ${time(snapshot.expiresAt)} (máximo 24 h).`;
      const label = (e) => `${e.allDay ? "Todo el día" : time(e.start)} · ${e.title}${e.participants.length ? ` · ${e.participants.join(", ")}` : ""}`;
      list("today", snapshot.events.filter((e) => e.firstDay <= today && e.lastDay >= today).map(label));
      const weekEnd = new Date(`${today}T12:00:00Z`); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      list("week", snapshot.events.filter((e) => e.lastDay >= today && e.firstDay <= weekEnd.toISOString().slice(0, 10)).map((e) => `${e.firstDay} · ${label(e)}`));
      const statuses = { pending: "Pendiente", done: "Hecho", in_review: "En revisión", needs_correction: "Por corregir", exempt: "Exento" };
      list("tasks", snapshot.tasks.map((t) => `${t.title}${t.assignee ? ` · ${t.assignee}` : ""} · ${statuses[t.status] || t.status}${t.day ? ` · ${t.day}` : ""}`));
      $("empty").hidden = true; $("snapshot").hidden = false;
    }
    const current = snapshot.events.find((e) => !e.allDay && Date.parse(e.start) <= now && now < (e.end ? Date.parse(e.end) : Date.parse(e.start) + 15 * 60_000));
    const next = snapshot.events.filter((e) => !e.allDay && Date.parse(e.start) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    const minutes = next ? Math.ceil((Date.parse(next.start) - now) / 60_000) : 0;
    $("countdown").textContent = current ? `Ahora: ${current.title}` : next ? `Próximo: ${next.title} · en ${Math.floor(minutes / 60)} h ${minutes % 60} min` : "Sin próximos eventos descargados";
  }
  render();
  const timer = setInterval(render, 1000);
  window.addEventListener("storage", (event) => {
    // Hide this tab's old copy without deleting a newer copy written by another tab.
    if (event.key === key || event.key === null) { clearInterval(timer); clear(false); }
  });
  // Reconnect through the server so authorization is checked again.
  window.addEventListener("online", () => location.replace(retry));
})();
