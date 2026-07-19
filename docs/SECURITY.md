# Security Documentation - Project Amazon PH Academy v2

## Overview
**Security Level:** Internal
**Last Review:** 2026-07-19
**Next Review:** 2026-10-19
**Owner:** Ryan Roland Dabao
**Status:** Active Implementation

---

## OWASP Top 10 Mitigations

### A01:2021 - Broken Access Control
- **Mitigation:** Role-based access control (RBAC) with principle of least privilege
- **Implementation:** Middleware checks on all protected routes via `src/middleware.ts`
- **Testing:** Automated tests for unauthorized access attempts
- **Status:** ✅ Implemented (ADR-004, ADR-005)

### A02:2021 - Cryptographic Failures
- **Mitigation:** TLS 1.3 for data in transit, AES-256 for data at rest
- **Implementation:** HTTPS enforced via Vercel, encrypted database fields
- **Testing:** SSL configuration scans
- **Status:** ✅ Implemented

### A03:2021 - Injection
- **Mitigation:** Parameterized queries, input validation, prepared statements
- **Implementation:** Prisma ORM with parameterized queries, input sanitization
- **Testing:** SQL injection tests, XSS tests
- **Status:** ✅ Implemented (Prisma middleware)

### A04:2021 - Insecure Design
- **Mitigation:** Threat modeling, secure design patterns
- **Implementation:** Security architecture review in design phase (ADR-004)
- **Testing:** Penetration testing
- **Status:** ✅ Implemented

### A05:2021 - Security Misconfiguration
- **Mitigation:** Hardened defaults, minimal attack surface
- **Implementation:** Security headers via Next.js, disabled debug mode in production
- **Testing:** Configuration audits
- **Status:** ✅ Implemented

### A06:2021 - Vulnerable Components
- **Mitigation:** Regular dependency updates, vulnerability scanning
- **Implementation:** Dependabot for automated updates, gitleaks for secret detection
- **Testing:** Snyk/OWASP Dependency Check
- **Status:** ✅ Implemented

### A07:2021 - Identity & Auth Failures
- **Mitigation:** Secure password policies, JWT with short expiration
- **Implementation:** JWT in HttpOnly cookies (ADR-004), refresh token rotation
- **Testing:** Brute force protection tests
- **Status:** ✅ Implemented

### A08:2021 - Software & Data Integrity
- **Mitigation:** Code signing, integrity verification
- **Implementation:** CI/CD pipeline with signed commits, audit logging
- **Testing:** Integrity checks
- **Status:** ✅ Implemented

### A09:2021 - Security Logging Failures
- **Mitigation:** Comprehensive audit logging
- **Implementation:** AuditLog table for all admin mutations (ADR-014)
- **Testing:** Log integrity verification
- **Status:** ✅ Implemented

### A10:2021 - SSRF
- **Mitigation:** Input validation, allowlist for external requests
- **Implementation:** URL validation, network segmentation
- **Testing:** SSRF attack simulations
- **Status:** ✅ Implemented

---

## Authentication & Authorization

### Authentication Methods
| Method | Use Case | Security Level |
|--------|----------|----------------|
| Email + Password | User login | High |
| JWT (HttpOnly) | Session management | High |
| Admin RBAC | Admin access | Critical |

### Password Policy
- **Minimum Length:** 12 characters
- **Complexity:** Upper, lower, number, special character
- **Expiration:** 90 days (optional)
- **History:** Cannot reuse last 12 passwords
- **Lockout:** 5 failed attempts → 15 minute lockout

### Session Management (ADR-004)
- **Token Type:** JWT with `jose` library (RS256 signing)
- **Storage:** HttpOnly Secure SameSite=Strict cookie
- **Expiration:** 15 minutes (access), 7 days (refresh)
- **Rotation:** Refresh token rotation on each request
- **Invalidation:** Client-side cookie clear on logout

---

## Data Protection

### Data Classification
| Level | Examples | Protection |
|-------|----------|------------|
| Public | Marketing pages | None |
| Internal | User profiles | Authentication required |
| Confidential | PII, payments | Encryption + access control |
| Restricted | Payment data | PCI compliance via PayMongo |

### Encryption
| Data State | Method | Standard |
|------------|--------|----------|
| In Transit | TLS 1.3 | HTTPS enforced (Vercel) |
| At Rest | AES-256 | Database encryption |
| Backups | GPG | Encrypted backups |
| Secrets | Environment variables | Never in code |

### PII Handling
- **Collection:** Minimal necessary data (email, name, payment info)
- **Storage:** Encrypted fields in PostgreSQL
- **Access:** Audit logged, role-based
- **Deletion:** Right to be forgotten supported (GDPR)
- **Export:** Data portability available

---

## API Security

### Rate Limiting
| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Auth endpoints | 5 requests | 1 minute |
| Read endpoints | 100 requests | 1 minute |
| Write endpoints | 30 requests | 1 minute |

### Input Validation
- **Request Schema:** Next.js validation
- **Content-Type:** Whitelist allowed types
- **File Upload:** Type, size, and content validation
- **SQL Injection:** Prisma parameterized queries only

### CORS Policy
```javascript
{
  "origin": ["https://amph-v2.vercel.app"],
  "methods": ["GET", "POST", "PUT", "DELETE"],
  "credentials": true,
  "maxAge": 86400
}
```

---

## Infrastructure Security

### Network Security
- **Hosting:** Vercel (managed infrastructure)
- **DDoS:** Vercel built-in protection
- **WAF:** Vercel Web Application Firewall

### Container Security
- **Base Images:** Minimal, distroless images
- **Scanning:** Trivy/Clair for vulnerabilities
- **Signing:** Image signing with Cosign
- **Runtime:** Read-only filesystem where possible

### Secrets Management
- **Storage:** Environment variables (Vercel Environment Variables)
- **Rotation:** Manual rotation for critical secrets
- **Access:** Least privilege, audit logged
- **Never:** In code, logs, or environment variables

---

## Compliance

### GDPR
- [x] Privacy policy published
- [x] Cookie consent implemented
- [x] Data processing agreements
- [x] Right to access/delete
- [x] Data breach notification process

### SOC2
- [x] Access controls documented
- [x] Audit logging enabled
- [x] Incident response plan
- [x] Vendor management
- [x] Regular security assessments

### Philippine Data Privacy Act
- [x] Privacy policy published
- [x] Cookie consent implemented
- [x] Data processing agreements
- [x] Right to access/delete
- [x] Data breach notification process

---

## Incident Response

### Response Team
| Role | Name | Contact |
|------|------|---------|
| Security Lead | Ryan Roland Dabao | ryan@projectamazonph.com |
| Engineering Lead | Ryan Roland Dabao | ryan@projectamazonph.com |
| Legal | Project Amazon PH | legal@projectamazonph.com |

### Incident Classification
| Severity | Description | Response Time |
|----------|-------------|---------------|
| P0 | Data breach, system compromise | Immediate |
| P1 | Vulnerability actively exploited | 1 hour |
| P2 | Potential vulnerability | 4 hours |
| P3 | Security improvement | 24 hours |

### Response Steps
1. **Detect:** Automated alerts (Sentry) + manual reports
2. **Contain:** Isolate affected systems
3. **Eradicate:** Remove threat
4. **Recover:** Restore systems
5. **Learn:** Post-incident review

---

## Security Testing

### Automated Testing
| Tool | Frequency | Scope |
|------|-----------|-------|
| Snyk | Every commit | Dependencies |
| Trivy | Every build | Containers |
| SonarQube | Every PR | Code quality |
| OWASP ZAP | Weekly | Dynamic analysis |
| Gitleaks | Every commit | Secret detection |

### Manual Testing
| Activity | Frequency | Scope |
|----------|-----------|-------|
| Penetration testing | Quarterly | Full application |
| Code review | Every PR | Security-critical code |
| Architecture review | Annually | System design |

---

## Security Checklist

### Development
- [x] Input validation on all user inputs
- [x] Parameterized queries for database (Prisma)
- [x] Proper error handling (no sensitive data in errors)
- [x] Security headers configured
- [x] CORS properly configured
- [x] Authentication on all protected routes

### Deployment
- [x] HTTPS enforced (Vercel)
- [x] Security headers enabled
- [x] Debug mode disabled
- [x] Default credentials changed
- [x] Unnecessary services disabled
- [x] Firewall rules configured

### Operations
- [x] Monitoring and alerting enabled (Sentry)
- [x] Log aggregation configured
- [x] Backup and recovery tested
- [x] Incident response plan documented
- [x] Security training completed

---

## Security Architecture

### File Dependency Chain (from AGENTS.md)
```
src/lib/        ← Pure utilities, no deps
   ↑
src/components/ ← UI primitives, depend on lib
   ↑
src/app/        ← Routes, depend on components + lib
   ↑
tests/          ← Mirror src structure
```

### Security Boundaries
1. **Middleware Layer:** JWT verification, RBAC checks
2. **Server Actions:** Input validation, business logic
3. **Database Layer:** Prisma ORM, parameterized queries
4. **External Services:** PayMongo, Resend, Vercel Blob

### Audit Trail (ADR-014)
- **Scope:** All admin mutations
- **Storage:** AuditLog table
- **Retention:** 2-year retention, then archival
- **Viewable:** `/admin/audit-log`

---

## Contact

For security issues, contact:
- **Email:** security@projectamazonph.com
- **Emergency:** ryan@projectamazonph.com

*© 2026 Project Amazon PH. All rights reserved.*