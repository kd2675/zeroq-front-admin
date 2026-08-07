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

assert.match(callbackSource, /ensureAccessToken\(\)/);
assert.doesNotMatch(callbackSource, /get\("token"\)|setAccessToken\(/);
assert.doesNotMatch(loginSource, /get\("token"\)/);
assert.match(loginSource, /oauth_provider_mismatch/);
assert.match(loginSource, /naver-zeroq-admin/);
assert.match(loginSource, /<form/);
assert.match(loginSource, /type="submit"/);
assert.doesNotMatch(signupSource, /임시값:\s*1234/);
assert.match(authSource, /explicitlySignedOut/);
assert.match(authSource, /requestGeneration !== authGeneration/);

console.log("ZeroQ admin authentication routing checks passed.");
