import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildLoginPath, sanitizeAuthNextPath } from "../app/lib/authRouting.ts";

assert.equal(sanitizeAuthNextPath("/analytics?range=7d"), "/analytics?range=7d");
assert.equal(sanitizeAuthNextPath("https://attacker.example/steal"), "/");
assert.equal(sanitizeAuthNextPath("//attacker.example/steal"), "/");
assert.equal(sanitizeAuthNextPath("/signup"), "/");
assert.equal(sanitizeAuthNextPath("/auth/callback"), "/");
assert.equal(buildLoginPath("/analytics?range=7d", { expired: true }), "/login?next=%2Fanalytics%3Frange%3D7d&expired=1");

const callbackSource = await readFile(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8");
const loginSource = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const signupSource = await readFile(new URL("../app/signup/page.tsx", import.meta.url), "utf8");
const authSource = await readFile(new URL("../app/lib/auth.ts", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8");
const accessSource = await readFile(new URL("../app/hooks/useAdminAccess.ts", import.meta.url), "utf8");
const profileSource = await readFile(new URL("../app/lib/profile.ts", import.meta.url), "utf8");

assert.match(callbackSource, /ensureAccessToken\(\)/);
assert.doesNotMatch(callbackSource, /get\("token"\)|setAccessToken\(/);
assert.doesNotMatch(loginSource, /get\("token"\)/);
assert.match(loginSource, /oauth_provider_mismatch/);
assert.match(loginSource, /naver-zeroq-admin/);
assert.match(loginSource, /AUTH_API_BASE.*oauth2\/authorize/s);
assert.match(loginSource, /<form/);
assert.match(loginSource, /type="submit"/);
assert.doesNotMatch(signupSource, /임시값:\s*1234/);
assert.match(authSource, /explicitlySignedOut/);
assert.match(authSource, /requestGeneration !== authGeneration/);
assert.match(authSource, /postAuthJson<LoginResponse>\("\/auth\/login"/);
assert.match(authSource, /postAuthJson<void>\("\/auth\/logout"/);
assert.match(apiSource, /NEXT_PUBLIC_API_MODE \?\? "direct"/);
assert.match(apiSource, /DEFAULT_DIRECT_ZEROQ_API_BASE = "http:\/\/localhost:20180"/);
assert.match(apiSource, /DEFAULT_DIRECT_AUTH_API_BASE = "http:\/\/localhost:9000"/);
assert.match(apiSource, /baseUrl: AUTH_API_BASE/);
assert.match(accessSource, /buildServiceAuthHeaders\(token\)/);
assert.match(profileSource, /buildServiceAuthHeaders\(accessToken\)/);
assert.match(authSource, /IS_GATEWAY_MODE \? null : getUserFromToken\(token\)/);
assert.match(authSource, /"X-User-Key"/);
assert.match(authSource, /"X-User-Role"/);

console.log("ZeroQ admin authentication routing checks passed.");
