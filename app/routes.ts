import { type RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

// Authoring tools for the local video/OG pipeline. The scripts that drive them
// (render_next_video.ts, generate_thumbnail.ts, generate_og_images.ts) all run
// against a local dev server, so these never need to ship.
// Patterns are minimatch globs tested against the path including its directory,
// so a bare filename will not match.
const DEV_ONLY_ROUTES = [
  "**/record.tsx",
  "**/record_mobile.tsx",
  "**/recordConstants.tsx",
  "**/thumbnail.$artist.$song.tsx",
  "**/og-image.$artist.$song.tsx",
];

const isProduction = process.env.NODE_ENV === "production";

export default flatRoutes({
  ignoredRouteFiles: isProduction ? DEV_ONLY_ROUTES : [],
}) satisfies RouteConfig;
