# Security Policy

## Supported Versions

We actively support the following versions of Nexus Signal with security updates:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Nexus Signal seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please send an email to: **security@nexussignal.ai**

Include the following information in your report:
- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full path of the affected source file(s)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Potential impact of the vulnerability

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
2. **Investigation**: Our team will investigate and validate the vulnerability within 7 days.
3. **Updates**: We will keep you informed of our progress throughout the process.
4. **Resolution**: Once resolved, we will notify you and discuss public disclosure timing.
5. **Credit**: With your permission, we will credit you in our security acknowledgments.

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Initial Response | 48 hours |
| Vulnerability Assessment | 7 days |
| Patch Development | 14-30 days (depending on severity) |
| Public Disclosure | After patch release |

## Scope

### In Scope

- nexussignal.ai (main website)
- api.nexussignal.ai (API server)
- Authentication and authorization mechanisms
- User data protection
- Payment processing security
- API endpoints

### Out of Scope

- Third-party services (Stripe, MongoDB Atlas, Cloudinary, etc.)
- Social engineering attacks
- Physical security
- Denial of Service (DoS/DDoS) attacks
- Vulnerabilities in outdated browsers
- Issues already reported or known

## Security Best Practices We Follow

- **Authentication**: JWT tokens with httpOnly cookies, 2FA support
- **Data Protection**: Password hashing with bcrypt, MongoDB sanitization
- **API Security**: Rate limiting, CORS configuration, input validation
- **Infrastructure**: HTTPS enforcement, security headers via Helmet.js
- **Code Security**: XSS protection, HPP prevention, SQL injection prevention

## Safe Harbor

We consider security research conducted in accordance with this policy to be:
- Authorized under the Computer Fraud and Abuse Act (CFAA)
- Exempt from DMCA restrictions
- Lawful and helpful to the security community

We will not pursue legal action against researchers who:
- Act in good faith
- Avoid privacy violations and data destruction
- Do not exploit vulnerabilities beyond demonstration
- Report findings promptly and responsibly

## Bug Bounty

We currently do not have a formal bug bounty program, but we recognize and appreciate security researchers who help improve our platform. Significant findings may be rewarded at our discretion.

## Contact

- Security Issues: security@nexussignal.ai
- General Inquiries: support@nexussignal.ai

---

Thank you for helping keep Nexus Signal and our users safe!
