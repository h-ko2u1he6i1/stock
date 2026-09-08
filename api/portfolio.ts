import { background, getRole, route } from "./_lib/http.js";
import { getSnapshot, isStale, refreshSnapshot, toResponse } from "./_lib/snapshot.js";

export default route(["GET"], async (req, res) => {
  const scope = (await getRole(req)) ?? "owner";
  const force = req.query.refresh === "1" || req.query.refresh === "true";
  const snapshot = await getSnapshot(scope);

  if (!snapshot || force) {
    const fresh = await refreshSnapshot(scope);
    res.json(toResponse(fresh, false));
    return;
  }

  if (isStale(snapshot)) {
    // Serve the cached data immediately; refresh in the background.
    background(refreshSnapshot(scope));
    res.json(toResponse(snapshot, true));
    return;
  }

  res.json(toResponse(snapshot, false));
});
