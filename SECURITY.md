# 🔐 Nexus Signal AI — Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version             | Supported |
| ------------------- | --------- |
| Latest (Production) | ✅         |
| Legacy / Pre-1.0    | ❌         |

---

## Reporting a Vulnerability

The security of Nexus Signal AI is a top priority. We welcome responsible disclosure of vulnerabilities that help us improve the platform.

### ⚠️ Do Not Use Public Channels

Please **do NOT** report vulnerabilities via GitHub issues, social media, or public forums.

---

## How to Report

Send all reports to:

📧 **[security@nexussignal.ai](mailto:security@nexussignal.ai)**

Include as much detail as possible:

* Vulnerability type (e.g., XSS, authentication bypass, injection)
* Affected endpoint(s), route(s), or file paths
* Step-by-step reproduction instructions
* Proof of concept (code, payload, or screenshots)
* Potential impact and severity assessment

---

## What to Expect

We aim to provide a fast, transparent response process:

| Stage                  | Timeline                      |
| ---------------------- | ----------------------------- |
| Initial acknowledgment | Within 24–48 hours            |
| Triage & validation    | Within 3–7 days               |
| Remediation            | 7–30 days (based on severity) |
| Public disclosure      | Coordinated after fix         |

We will:

* Keep you informed throughout the process
* Work collaboratively on validation
* Notify you once resolved
* Offer attribution (with your permission)

---

## Scope

### ✅ In Scope

* https://nexussignal.ai
* https://api.nexussignal.ai
* Authentication & session management
* Authorization / access control
* Signal data integrity
* Payment and subscription systems
* API endpoints and backend services

---

### ❌ Out of Scope

* Third-party providers (Stripe, MongoDB Atlas, Cloudinary, etc.)
* Social engineering or phishing attacks
* Physical access or device-level attacks
* Denial of Service (DoS / DDoS)
* Rate-limit abuse without security impact
* Issues in outdated or unsupported browsers
* Previously reported or known issues

---

## Security Practices

We implement industry-standard security measures:

### Authentication & Access

* JWT-based authentication (httpOnly cookies)
* Optional 2FA support
* Role-based access controls

### Data Protection

* Password hashing (bcrypt)
* Input validation and sanitization
* MongoDB query protection

### API & Infrastructure

* Rate limiting and abuse protection
* CORS configuration
* HTTPS enforced across all endpoints
* Security headers via Helmet.js

### Application Security

* XSS mitigation
* HPP (HTTP Parameter Pollution) protection
* Injection prevention
* Secure environment variable handling

---

## Safe Harbor

We support and protect responsible security research.

If you act in good faith and follow this policy:

* You are authorized to test Nexus Signal AI systems
* We will not pursue legal action
* Your research will be treated as beneficial

Requirements:

* Do not access or expose user data unnecessarily
* Do not disrupt service availability
* Do not exploit beyond proof-of-concept
* Report findings promptly

---

## Recognition

We currently do not operate a public bug bounty program.

However, we:

* Acknowledge valid reports
* May offer discretionary rewards for significant findings
* Credit researchers (with permission)

---

## Contact

Security reports:
📧 [security@nexussignal.ai](mailto:security@nexussignal.ai)

General support:
📧 [support@nexussignal.ai](mailto:support@nexussignal.ai)

---

Nexus Signal AI is committed to maintaining a secure, transparent, and trustworthy platform for all users.
