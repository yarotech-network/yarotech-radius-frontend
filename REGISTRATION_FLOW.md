# Three-step registration

/register now verifies email before creating any user or workspace. Step two captures business name, editable workspace ID (the real unique Tenant.slug used by /s/:slug), first/last name, existing sign-in username, contact phone (no verification), and password confirmation. Success shows Workspace Ready and links to /login. No persona/referral/Telegram sections.

Backend companion: ../yarotech-radius-backend/REGISTRATION_FLOW_PLAN.md. Deploy accounts migration 0005 and the new registration endpoints before this frontend. Existing /auth/register/ and /verify-email flows remain compatible for older clients/accounts.

Temporary registration proof and passwords stay only in component memory. Refresh restarts verification. Validation errors preserve the current form; expired proof provides a Verify email again action. No client-side email-verification bypass exists.

Completion links: VITE_WHATSAPP_COMMUNITY_URL accepts your HTTPS community URL. Until supplied, the WhatsApp item is visibly unavailable. VITE_USER_GUIDE_URL optionally supplies an HTTPS guide; the built-in /guide is the default. Rebuild/restart Vite when configuring these variables. The user has been asked for the real links; no reference-site destinations are copied.

Validation: 21 frontend tests passed (registration flow, invalid OTP, duplicate/custom slug, completion links, and legacy verification). Backend accounts suite: 40 passed, 1 existing optional browser test skipped, including real PostgreSQL concurrency/rollback checks. All three steps passed browser checks at 1440/768/390/320 using sample API responses, without horizontal overflow or page errors. Desktop creation and mobile ready screenshots visually reviewed. Scoped ESLint, TypeScript and production build passed. SMTP/provider delivery and deployed end-to-end signup were not exercised.
