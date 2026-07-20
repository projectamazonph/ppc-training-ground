# Sentinel Journal — Critical Security Learnings

## 2026-07-16 - Synchronous Password Hashing Blocks Next.js Event Loop (DoS Risk)
**Vulnerability:** The application used `scryptSync` (synchronous CPU-intensive password hashing) inside Next.js server action handlers for registration and login. Because Node.js runs on a single main event loop, a small number of concurrent authentication requests (or a distributed credential stuffing attack) completely blocks the event loop, starving all other concurrent requests and causing a full Denial of Service (DoS).
**Learning:** Next.js Server Actions and Route Handlers run on Node's main thread by default. Using synchronous cryptography operations (such as `scryptSync` or `pbkdf2Sync`) prevents the server from processing other concurrent connections.
**Prevention:** Always use asynchronous password-hashing implementations (such as async `scrypt` wrapped in a Promise or bcrypt/argon2 async variants) inside Next.js/Node.js web entry points to delegate heavy hashing computations to the Node.js libuv thread pool, keeping the main event loop responsive.

## 2026-07-20 - Email/User Enumeration via Auth Timing Attack in Next.js Server Actions
**Vulnerability:** The `signInAction` bypassed the CPU-heavy password verification logic when a requested user email was not found in the database. This timing difference allowed attackers to perform fast, automated timing attacks to accurately enumerate registered emails/users from the application.
**Learning:** Returning early or skipping slow cryptographic operations (such as password hashing/scrypt) when a database record is missing creates a significant timing side-channel.
**Prevention:** Always perform a simulated or "dummy" verification check against a synthetic hash in the same format when a database record is not found. This ensures that response times remain uniform regardless of whether the email is registered or not, successfully neutralizing email enumeration attacks.
