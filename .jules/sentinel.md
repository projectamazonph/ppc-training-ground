# Sentinel Journal — Critical Security Learnings

## 2026-07-16 - Synchronous Password Hashing Blocks Next.js Event Loop (DoS Risk)
**Vulnerability:** The application used `scryptSync` (synchronous CPU-intensive password hashing) inside Next.js server action handlers for registration and login. Because Node.js runs on a single main event loop, a small number of concurrent authentication requests (or a distributed credential stuffing attack) completely blocks the event loop, starving all other concurrent requests and causing a full Denial of Service (DoS).
**Learning:** Next.js Server Actions and Route Handlers run on Node's main thread by default. Using synchronous cryptography operations (such as `scryptSync` or `pbkdf2Sync`) prevents the server from processing other concurrent connections.
**Prevention:** Always use asynchronous password-hashing implementations (such as async `scrypt` wrapped in a Promise or bcrypt/argon2 async variants) inside Next.js/Node.js web entry points to delegate heavy hashing computations to the Node.js libuv thread pool, keeping the main event loop responsive.

## 2026-07-24 - Dual-Layer Rate Limiting on Authentication Actions
**Vulnerability:** Singly rate-limiting Next.js Server Actions by target email allows a distributed credential stuffing/brute force attack where attackers change targets or IPs to bypass simple limits.
**Learning:** Target-based limits alone do not prevent brute-forcing different accounts from a single IP, and IP-based limits alone can easily block innocent users behind shared proxies/NATs if they hit limits too early.
**Prevention:** Implement dual rate-limiting on unauthenticated entry points (like sign-in and sign-up). Combine a target-based key (e.g. `signup:${email.toLowerCase()}`) with an IP-based key retrieved via request headers (`x-forwarded-for` / `x-real-ip`) to secure authentication actions robustly.
