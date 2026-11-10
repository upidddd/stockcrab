// Update checker: the latest GitHub release against this version (asked by the panel, at most every 6 hours).

const RELEASES = "https://api.github.com/repos/upidddd/stockcrab/releases/latest";
const RELEASE_PAGE = "https://github.com/upidddd/stockcrab/releases/latest";
// this version: from the manifest, or from the panel (Chrome's engine host cannot read the manifest)
let update = { current: null, latest: null, url: RELEASE_PAGE, checked: 0, error: null };
try {
  update.current = browser.runtime.getManifest().version;
} catch (e) {}

const newer = (a, b) => {
  const x = String(a).split(".").map(Number);
  const y = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

async function checkUpdates(force = false, current = null) {
  if (current) update.current = current;
  if (!force && Date.now() - update.checked < 6 * 3600 * 1000) return update;
  try {
    const r = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
    if (!r.ok) throw new Error("GitHub answered " + r.status);
    const rel = await r.json();
    update = { ...update, latest: String(rel.tag_name || "").replace(/^v/, ""), url: rel.html_url || RELEASE_PAGE, checked: Date.now(), error: null };
  } catch (e) {
    update = { ...update, checked: Date.now(), error: String(e.message || e) };
  }
  return update;
}

const updateState = () => ({ ...update, available: !!update.latest && !!update.current && newer(update.latest, update.current) });

// Firefox installs a newer version from the release (update_url in the manifest) and restarts the extension.
async function installUpdate() {
  try {
    if (browser.runtime.requestUpdateCheck) {
      const r = await browser.runtime.requestUpdateCheck();
      const status = Array.isArray(r) ? r[0] : r?.status ?? r;
      if (status === "update_available") return { ok: true, status };
      return { ok: false, status: String(status), url: update.url };
    }
  } catch (e) {
    return { ok: false, status: String(e.message || e), url: update.url };
  }
  return { ok: false, status: "unsupported", url: update.url };
}

try {
  browser.runtime.onUpdateAvailable?.addListener(() => browser.runtime.reload());
} catch (e) {}
