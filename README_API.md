# Bible Dose — API Specification

> **Version:** 1.0.0  
> **Base URL:** `https://api.bibledose.com/api`  
> **Content-Type:** `application/json`  
> **Authentication:** Session cookie (`credentials: 'include'`) or Bearer token for protected routes.

---

## Table of Contents

1. [Authentication](#1-authentication)
   - [POST /auth/login](#11-post-apiv1authlogin)
   - [POST /auth/forgot-password](#12-post-apiv1authforgot-password)
   - [POST /auth/reset](#13-post-apiv1authreset)
   - [POST /auth/recover-request](#14-post-apiv1authrecover-request)
   - [POST /auth/verify-sms](#15-post-apiv1authverify-sms)
   - [POST /auth/signin](#16-post-apiv1authsignin)
2. [Dashboard](#2-dashboard)
   - [GET /dashboard](#21-get-apiv1dashboard)
3. [User Profile & Settings](#3-user-profile--settings)
   - [POST /user/profile](#31-post-apiv1userprofile)
   - [POST /user/avatar](#32-post-apiv1useravatar)
   - [POST /settings/password](#33-post-apiv1settingspassword)
4. [Sessions (Studies)](#4-sessions-studies)
   - [POST /sessions/validate-code](#41-post-apiv1sessionsvalidate-code)
   - [POST /sessions/join](#42-post-apiv1sessionsjoin)
   - [POST /sessions/share](#43-post-apiv1sessionsshare)
   - [POST /sessions/invite](#44-post-apiv1sessionsinvite)
5. [Groups](#5-groups)
   - [GET /groups/:groupId/status](#51-get-apiv1groupsgroupidstatus)
   - [POST /groups/:groupId/register](#52-post-apiv1groupsgroupidregister)
   - [POST /groups/validate-code](#53-post-apiv1groupsvalidate-code)
   - [POST /groups/register](#54-post-apiv1groupsregister)
6. [Guests](#6-guests)
   - [POST /guest/join](#61-post-apiv1guestjoin)
7. [Data Structures](#7-data-structures)
8. [Error Reference](#8-error-reference)

---

## 1. Authentication

### 1.1 POST /api/v1/auth/login

**Page/Component:** `login.html` · `js/login-script.js`

Authenticates a participant using email and password. On success, the server sets a session cookie and the frontend redirects to the dashboard. On failure, the frontend applies inline error styling. After 3+ attempts, a lockout warning appears; after 5 attempts, the sign-in button disables entirely.

**Request Body:**

```json
{
  "email": "test@bibledose.com",
  "password": "Password123"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `email` | string | Yes | Registered email address |
| `password` | string | Yes | Plain-text password (transmitted over HTTPS only) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "user": {
    "id": "u-001",
    "firstName": "Jordan",
    "lastName": "Mills",
    "email": "jordan.mills@email.com",
    "initials": "JM",
    "avatarUrl": null
  }
}
```

The frontend then performs `window.location.href = 'dashboard.html'`.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `401 Unauthorized` | `{ "success": false, "error": "invalid_credentials" }` | Wrong email or password — **message must be generic** (never reveal which field failed) |
| `429 Too Many Requests` | `{ "success": false, "error": "rate_limited" }` | Account temporarily locked after repeated failures |
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "email": "Valid email required" } }` | Missing or malformed fields |

**Security rules:**
- Error response message is always `"Incorrect email or password."` — never differentiate between "email not found" and "wrong password."
- Server tracks failed attempts per account; after a configurable threshold the account is locked (frontend disables the button at 5).
- Password is transmitted over HTTPS and never logged.

---

### 1.2 POST /api/v1/auth/forgot-password

**Page/Component:** `forgot-password.html` · `js/forgot-password.js`

Requests a password reset link. For enumeration safety, the frontend **always** shows the confirmation state ("Check your inbox") regardless of whether the email exists. The server silently decides whether to send the email.

**Request Body:**

```json
{
  "email": "jordan.mills@email.com"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `email` | string | Yes | Email address to send the reset link to |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "If an account exists for that address, a reset link has been sent."
}
```

**Notes:**
- The response is identical whether the email exists or not (enumeration-safe).
- On the server, if the email maps to a user: generate a single-use, signed reset token (30-minute TTL), store it in a `reset_tokens` table, and send the transactional email (`reset-password-email.html`).
- **Email merge fields:** `{{FIRST_NAME}}`, `{{RESET_LINK}}`, `{{EXPIRY}}`.

**Email template** (`reset-password-email.html`):

```
To: jordan.mills@email.com
Subject: Reset your Bible Dose password

Hi Jordan,

Someone (hopefully you) asked to reset the password for your Bible Dose account.
Tap the button below to choose a new one.

[Reset my password] → https://bibledose.com/reset-password?token=<signed-token>

This link expires in 30 minutes and can only be used once.
```

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error" }` | Email missing or empty |
| `500 Internal Server Error` | `{ "success": false, "error": "email_failed" }` | SMTP failure (log only; frontend still shows confirmation) |

---

### 1.3 POST /api/v1/auth/reset

**Page/Component:** `reset-password.html` · `js/reset-password-script.js`

Sets a new password using a one-time reset token. The token is extracted from the query string (`?token=...`). If the token is invalid, expired, or already used, the page displays the "Link expired" state.

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "new_password": "NewP@ssw0rd!2025"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `token` | string | Yes | Single-use signed reset token from the email link |
| `new_password` | string | Yes | New password (min 8 chars; strength bar is client-only informational) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

On success, the frontend shows the "Password updated" state with a link to `login.html`. The server **must**: hash the new password, mark the token as used, clear any failed-attempt counters, and invalidate all existing sessions for that user.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "new_password": "Must be at least 8 characters" } }` | Password too short or missing |
| `410 Gone` | `{ "success": false, "error": "token_expired" }` | Token is expired (> 30 min) |
| `409 Conflict` | `{ "success": false, "error": "token_used" }` | Token was already consumed |
| `404 Not Found` | `{ "success": false, "error": "token_invalid" }` | Token not found or malformed |

**Server-side token verification:**
- Token is verified **before** rendering the page. If invalid/expired/used, the server either redirects or injects the "expired" state directly into the HTML.
- For dev testing, `?expired=true` simulates the expired state.

---

### 1.4 POST /api/v1/auth/recover-request

**Page/Component:** `recover-email.html` · `js/recover-email-script.js` — Step 1

Initiates an email recovery flow via SMS. The user enters a registered phone number. For enumeration safety, the server **always advances** to the code-entry step regardless of whether the phone exists.

**Request Body:**

```json
{
  "phone": "787-555-0198"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `phone` | string | Yes | 10-digit US phone number, formatted as `000-000-0000` |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "If this number matches an account, a verification code has been sent."
}
```

**Notes:**
- The response is identical whether the phone number is registered or not (enumeration-safe).
- Server sends a 6-digit SMS code only if the phone belongs to a verified account.
- Frontend always transitions to Step 2 (code entry) after submission.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error" }` | Phone missing or not 10 digits |

---

### 1.5 POST /api/v1/auth/verify-sms

**Page/Component:** `recover-email.html` · `js/recover-email-script.js` — Step 2

Verifies the 6-digit SMS code sent in the recovery flow. On success, returns the masked email address. The frontend mock uses `123456` as the correct code.

**Request Body:**

```json
{
  "code": "123456"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `code` | string | Yes | 6-digit numeric code received via SMS |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "masked_email": "***m46@gmail.com",
  "full_email": "jordan.mills@email.com"
}
```

| Field | Type | Description |
|:---|:---|:---|
| `masked_email` | string | Partially masked email for display (e.g. `"***m46@gmail.com"`) |
| `full_email` | string | Unmasked email for internal use (pre-fill login, etc.) |

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `401 Unauthorized` | `{ "success": false, "error": "invalid_code" }` | Wrong or expired code |
| `410 Gone` | `{ "success": false, "error": "code_expired" }` | Code TTL exceeded |
| `400 Bad Request` | `{ "success": false, "error": "validation_error" }` | Code missing or not 6 digits |

---

### 1.6 POST /api/v1/auth/signin

**Page/Component:** `modal-flow.html` · `js/modal-flow-script.js` — Modals M01 & M07

Called from the Join Flow when the user clicks "Sign in →" from the live-session entry (M01) or no-live entry (M07). The backend returns the user's membership status for a specific group so the frontend can route to the correct next modal.

**Request Body:**

```json
{
  "groupId": "g-dev-001"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `groupId` | string | Yes | Group identifier from the join link |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "user": {
    "id": "u-dev-001",
    "name": "Jordan Smith"
  },
  "isMember": true
}
```

| Field | Type | Description |
|:---|:---|:---|
| `success` | boolean | `true` if the user is authenticated |
| `user.id` | string | Internal user ID |
| `user.name` | string | Full name for the welcome screen and cookie |
| `isMember` | boolean | Whether the user already belongs to this group |

**Frontend routing based on response:**

| Context | `isMember: true` | `isMember: false` |
|:---|:---|:---|
| Live session (M01) | → M04 "Welcome back" → auto-advance to session | → M02 "You're not in this group" |
| No session (M07) | → M08 "Nothing live right now" → dashboard | → M09 "Register for this group" |

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `401 Unauthorized` | `{ "success": false, "error": "not_authenticated" }` | No valid session |
| `404 Not Found` | `{ "success": false, "error": "group_not_found" }` | `groupId` doesn't exist |

---

## 2. Dashboard

### 2.1 GET /api/v1/dashboard

**Page/Component:** `dashboard.html` · `js/dashboard-script.js` — Render engine

Returns the full dashboard payload for the authenticated user. Called on page load. The frontend render engine consumes this object and renders the welcome banner, live zone, and study history sections.

**Query Parameters:**

| Param | Type | Required | Description |
|:---|:---|:---|:---|
| `userId` | string | Yes | Authenticated user ID (or derived from session server-side) |

**Success Response** `200 OK`:

```json
{
  "registered": true,
  "user": {
    "id": "u-001",
    "firstName": "Jordan",
    "lastName": "Mills",
    "initials": "JM",
    "email": "jordan.mills@email.com",
    "avatarUrl": null
  },
  "zone": [
    {
      "id": "gs1",
      "title": "The Good Soil",
      "leader": "Elias Ocasio",
      "church": "Life Church",
      "lifecycle": "live",
      "start": 1719203040000,
      "startedAgo": 360000,
      "inRoom": 8,
      "participants": [
        { "id": "u-011", "initials": "EO", "name": "Elias Ocasio" },
        { "id": "u-022", "initials": "LC", "name": "Laura Chen" },
        { "id": "u-033", "initials": "GS", "name": "Grace Solano" },
        { "id": "u-044", "initials": "MR", "name": "Marcus Reid" },
        { "id": "u-055", "initials": "TK", "name": "Tina Kwan" }
      ]
    }
  ],
  "past": [
    {
      "id": "gs0",
      "title": "The Good Soil",
      "leader": "Elias Ocasio",
      "church": "Life Church",
      "start": 1718595840000,
      "attended": true,
      "notesUrl": "https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c"
    },
    {
      "id": "gs00",
      "title": "The Good Soil",
      "leader": "Elias Ocasio",
      "church": "Life Church",
      "start": 1717991040000,
      "attended": false,
      "notesUrl": "https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c"
    }
  ]
}
```

**Field Reference:**

| Field | Type | Description |
|:---|:---|:---|
| `registered` | boolean | `true` = user belongs to ≥1 study group; `false` = authenticated but no group |
| `user` | object | Authenticated user profile |
| `user.id` | string | Internal user identifier |
| `user.firstName` | string | Name for welcome greeting and avatar pill |
| `user.lastName` | string | Surname (reserved for future use) |
| `user.initials` | string | 1–2 characters for the avatar pill when no `avatarUrl` |
| `user.email` | string | User's email address |
| `user.avatarUrl` | string\|null | URL of uploaded avatar image; `null` if none |
| `zone` | ZoneSession[] | Sessions within the active lifecycle window; empty array when idle |
| `zone[].id` | string | Stable unique session identifier (used as React-style key) |
| `zone[].title` | string | Study/series name |
| `zone[].leader` | string | Full name of the group leader |
| `zone[].church` | string | Congregation name |
| `zone[].lifecycle` | `"live"` \| `"soon"` \| `"finished"` | Current state determined by the backend |
| `zone[].start` | number | Unix timestamp ms — when it started (`live`/`finished`) or starts (`soon`) |
| `zone[].startedAgo` | number | Millis since start (for `live`; may be derived by frontend if omitted) |
| `zone[].inRoom` | number | Total people in the room including leader (only meaningful for `live`) |
| `zone[].endedAgo` | number | Millis since session ended (for `finished`) |
| `zone[].participants` | Participant[] | Visible participants for avatar rendering (only for `live`) |
| `zone[].participants[].id` | string | Participant user ID |
| `zone[].participants[].initials` | string | 1–2 chars for avatar circle |
| `zone[].participants[].name` | string | Full name (accessibility / tooltip) |
| `past` | PastSession[] | Completed sessions ordered by `start` descending |
| `past[].id` | string | Stable unique session identifier |
| `past[].title` | string | Study/series name |
| `past[].leader` | string | Full name of the leader |
| `past[].church` | string | Congregation name |
| `past[].start` | number | Unix timestamp ms of session start |
| `past[].attended` | boolean | Whether the authenticated user attended this session |
| `past[].notesUrl` | string | Public URL for read-only study notes/recap |

**Frontend rendering logic:**
- `registered: false` → hides the zone, shows "You're not in any studies yet" with Join/Register CTAs.
- `zone` empty + `registered: true` → shows "No past studies yet."
- `past` empty + `registered: true` → empty history state.
- Frontend sorts `zone` by priority: `live` → `soon` → `finished`.
- Frontend paginates `past` at 10 items per page with search + date-range filtering.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `401 Unauthorized` | `{ "success": false, "error": "not_authenticated" }` | No valid session — redirect to login |

---

## 3. User Profile & Settings

### 3.1 POST /api/v1/user/profile

**Page/Component:** `dashboard.html` — Screen 3 (Profile) · `js/dashboard-script.js`

Updates the authenticated user's name and email. The "Save changes" button is disabled until at least one field differs from the original value.

**Request Body:**

```json
{
  "firstName": "Jordan",
  "lastName": "Mills",
  "email": "jordan.mills@email.com"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `firstName` | string | Yes | Updated first name |
| `lastName` | string | No | Updated last name (can be empty) |
| `email` | string | Yes | Updated email address |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "user": {
    "id": "u-001",
    "firstName": "Jordan",
    "lastName": "Mills",
    "initials": "JM",
    "email": "jordan.mills@email.com",
    "avatarUrl": null
  }
}
```

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "firstName": "First name is required", "email": "Please enter a valid email address" } }` | Missing or invalid fields |
| `409 Conflict` | `{ "success": false, "error": "email_taken" }` | Email already belongs to another account |
| `401 Unauthorized` | `{ "success": false, "error": "not_authenticated" }` | No valid session |

---

### 3.2 POST /api/v1/user/avatar

**Page/Component:** `dashboard.html` — Screen 3 (Profile) · `js/dashboard-script.js`

Uploads a new profile photo for the authenticated user. The frontend accepts JPG, PNG, or GIF up to 2 MB.

**Request:**

```
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `avatarFile` | File | Yes | Image file (JPG, PNG, GIF; max 2 MB) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "avatarUrl": "https://cdn.bibledose.com/avatars/u-001/abc123.jpg"
}
```

| Field | Type | Description |
|:---|:---|:---|
| `avatarUrl` | string | Public URL of the uploaded avatar |

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "avatarFile": "File must be JPG, PNG, or GIF and under 2 MB" } }` | Wrong file type or too large |
| `401 Unauthorized` | `{ "success": false, "error": "not_authenticated" }` | No valid session |

---

### 3.3 POST /api/v1/settings/password

**Page/Component:** `dashboard.html` — Screen 2 (Settings) · `js/dashboard-script.js`

Changes the authenticated user's password. Requires the current password for verification.

**Request Body:**

```json
{
  "currentPassword": "OldP@ssw0rd!",
  "newPassword": "NewP@ssw0rd!2025"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `currentPassword` | string | Yes | Existing password for verification |
| `newPassword` | string | Yes | New password (min 8 characters) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "Password updated successfully."
}
```

On success, the frontend shows a toast ("Changes saved") and clears the form.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "newPassword": "Password must be at least 8 characters" } }` | New password too short |
| `403 Forbidden` | `{ "success": false, "error": "incorrect_password" }` | Current password is wrong |
| `401 Unauthorized` | `{ "success": false, "error": "not_authenticated" }` | No valid session |

---

## 4. Sessions (Studies)

### 4.1 POST /api/v1/sessions/validate-code

**Page/Component:** `dashboard.html` — Join Modal · `js/dashboard-script.js`

Validates a join code entered in the "Join a different study" modal. The frontend debounces input by 900ms before sending. Codes are force-uppercased by the client.

**Request Body:**

```json
{
  "code": "ABCD12"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `code` | string | Yes | Join code (alphanumeric, case-insensitive, displayed uppercase) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "session": {
    "id": "gs1",
    "title": "The Good Soil",
    "church": "Life Church",
    "leader": "Elias Ocasio",
    "time": "7:00 PM"
  }
}
```

On success, the left panel transitions to a rigid confirmation block showing study/church/session time.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `404 Not Found` | `{ "success": false, "error": "code_not_recognized" }` | Code doesn't match any active session |
| `410 Gone` | `{ "success": false, "error": "session_ended" }` | Code is valid but the session already finished |
| `400 Bad Request` | `{ "success": false, "error": "validation_error" }` | Code missing or malformed |

---

### 4.2 POST /api/v1/sessions/join

**Page/Component:** `dashboard.html` — Join Modal · `js/dashboard-script.js`

Joins the authenticated user to a session. Two modes:
- **Code mode:** User confirmed a join code via `/sessions/validate-code`.
- **Room mode:** User entered a Room ID and Room Passcode manually.

**Request Body (Code mode):**

```json
{
  "mode": "code",
  "code": "ABCD12"
}
```

**Request Body (Room mode):**

```json
{
  "mode": "room",
  "roomId": "room-xyz",
  "roomPasscode": "pass123"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `mode` | `"code"` \| `"room"` | Yes | Join method |
| `code` | string | If `mode === "code"` | Previously validated join code |
| `roomId` | string | If `mode === "room"` | Room identifier |
| `roomPasscode` | string | If `mode === "room"` | Room passcode |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "You're in! Joining the study…",
  "sessionUrl": "/session/gs1"
}
```

The frontend shows a success state for 2 seconds then closes the modal. In a real integration it would redirect to `sessionUrl`.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error" }` | Missing required fields for selected mode |
| `403 Forbidden` | `{ "success": false, "error": "invalid_passcode" }` | Room passcode is wrong |
| `404 Not Found` | `{ "success": false, "error": "room_not_found" }` | Room ID doesn't exist |
| `409 Conflict` | `{ "success": false, "error": "already_joined" }` | User is already in the session |
| `410 Gone` | `{ "success": false, "error": "session_ended" }` | Session is no longer active |

---

### 4.3 POST /api/v1/sessions/share

**Page/Component:** `dashboard.html` — Share Modal · `js/dashboard-script.js`

Shares a past session's study notes with someone via email or SMS. The form requires first name + (valid email OR valid phone).

**Request Body:**

```json
{
  "sessionId": "gs0",
  "notesUrl": "https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c",
  "firstName": "Maria",
  "lastName": "Torres",
  "email": "maria@email.com",
  "phone": null
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `sessionId` | string | Yes | Session identifier to share |
| `notesUrl` | string | Yes | Read-only URL of the study notes |
| `firstName` | string | Yes | Recipient's first name |
| `lastName` | string | No | Recipient's last name (nullable) |
| `email` | string | At least one of `email` or `phone` | Recipient email address |
| `phone` | string | At least one of `email` or `phone` | Recipient phone number (`000-000-0000` format) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "Study shared successfully."
}
```

The frontend shows a success state for 2 seconds then closes the modal.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "firstName": "First name is required" } }` | Missing required fields or neither email nor phone provided |
| `404 Not Found` | `{ "success": false, "error": "session_not_found" }` | `sessionId` doesn't exist |

---

### 4.4 POST /api/v1/sessions/invite

**Page/Component:** `dashboard.html` — Invite Guest Modal · `js/dashboard-script.js`

Invites a guest to a live or upcoming session. The form requires first name + (valid email OR valid phone). Separate from the "Share study" flow.

**Request Body:**

```json
{
  "sessionId": "gs1",
  "firstName": "Laura",
  "lastName": "Chen",
  "email": "laura.chen@email.com",
  "phone": null
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `sessionId` | string | Yes | Session to invite the guest to |
| `firstName` | string | Yes | Guest's first name |
| `lastName` | string | No | Guest's last name (nullable) |
| `email` | string | At least one of `email` or `phone` | Guest email address |
| `phone` | string | At least one of `email` or `phone` | Guest phone number (`000-000-0000` format) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "Invitation sent."
}
```

The frontend shows a success state ("Guest registered!") with a copied-link confirmation on the left panel.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "firstName": "First name is required" } }` | Missing required fields |
| `404 Not Found` | `{ "success": false, "error": "session_not_found" }` | `sessionId` doesn't exist |

---

## 5. Groups

### 5.1 GET /api/v1/groups/:groupId/status

**Page/Component:** `modal-flow.html` · `js/modal-flow-script.js` — Auto-start

Called when the join-flow page loads to determine whether a group has a live session. Used when `isLive` is not explicitly provided in the join-link URL parameters.

**URL Parameters:**

| Param | Type | Description |
|:---|:---|:---|
| `groupId` | string | Group identifier (path parameter) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "isLive": true,
  "groupName": "The Good Soil"
}
```

| Field | Type | Description |
|:---|:---|:---|
| `isLive` | boolean | Whether the group currently has an active session |
| `groupName` | string | Human-readable group name for display across all modals |

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `404 Not Found` | `{ "success": false, "error": "group_not_found" }` | `groupId` doesn't exist |

---

### 5.2 POST /api/v1/groups/:groupId/register

**Page/Component:** `modal-flow.html` · `js/modal-flow-script.js` — Modals M02 & M09

Registers the authenticated user as a member of a specific group. Called from two points in the join flow: live-session context (M02) and no-session context (M09).

**URL Parameters:**

| Param | Type | Description |
|:---|:---|:---|
| `groupId` | string | Group identifier (path parameter) |

**Request Body:**

```json
{
  "context": "live"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `context` | `"live"` \| `"nolive"` | Yes | Which flow the registration originated from; affects which modal the frontend shows next |

**Success Response** `200 OK`:

```json
{
  "success": true
}
```

**Frontend routing:**

| `context` | On success |
|:---|:---|
| `"live"` | → M05 "You're all set" (teal, auto-advances to session) |
| `"nolive"` | → M12 "You're now a member" (teal) |

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `401 Unauthorized` | `{ "success": false, "error": "not_authenticated" }` | No valid session |
| `404 Not Found` | `{ "success": false, "error": "group_not_found" }` | `groupId` doesn't exist |
| `409 Conflict` | `{ "success": false, "error": "already_member" }` | User is already a member of this group |

---

### 5.3 POST /api/v1/groups/validate-code

**Page/Component:** `dashboard.html` — Register Modal · `js/dashboard-script.js`

Validates a group code entered in the "Register for a Group" modal. Identical UX pattern to the Join code validation. The frontend debounces input by 900ms and uppercases.

**Request Body:**

```json
{
  "code": "GRP789"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `code` | string | Yes | Group code (alphanumeric, case-insensitive) |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "group": {
    "id": "g-002",
    "title": "Faith and Works",
    "leader": "Maria Torres",
    "church": "Grace Chapel"
  }
}
```

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `404 Not Found` | `{ "success": false, "error": "code_not_recognized" }` | Code doesn't match any group |
| `400 Bad Request` | `{ "success": false, "error": "validation_error" }` | Code missing or malformed |

---

### 5.4 POST /api/v1/groups/register

**Page/Component:** `dashboard.html` — Register Modal · `js/dashboard-script.js`

Registers the user for a group. Two modes:
- **Code mode:** User confirmed a group code via `/groups/validate-code`.
- **Group name mode:** User typed a group name manually.

**Request Body (Code mode):**

```json
{
  "mode": "code",
  "code": "GRP789"
}
```

**Request Body (Group name mode):**

```json
{
  "mode": "groupName",
  "groupName": "Faith and Works"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `mode` | `"code"` \| `"groupName"` | Yes | Registration method |
| `code` | string | If `mode === "code"` | Previously validated group code |
| `groupName` | string | If `mode === "groupName"` | Group name entered manually |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "message": "You're registered for the group!"
}
```

The frontend shows a success state for 2 seconds then closes the modal.

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error" }` | Missing required fields |
| `404 Not Found` | `{ "success": false, "error": "group_not_found" }` | Group code or name doesn't match any group |
| `409 Conflict` | `{ "success": false, "error": "already_member" }` | User already belongs to this group |

---

## 6. Guests

### 6.1 POST /api/v1/guest/join

**Page/Component:** `modal-flow.html` · `js/modal-flow-script.js` — Modal M03

Allows an unauthenticated user to join a live session as a guest. Requires first name, last name, and email. The frontend validates email format and match confirmation before enabling the submit button.

**Request Body:**

```json
{
  "groupId": "g-dev-001",
  "firstName": "Jordan",
  "lastName": "Smith",
  "email": "jordan@email.com"
}
```

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `groupId` | string | Yes | Group identifier for the session |
| `firstName` | string | Yes | Guest's first name (auto-capitalized by frontend) |
| `lastName` | string | Yes | Guest's last name (auto-capitalized by frontend) |
| `email` | string | Yes | Guest's email address; validated for format and confirmed by a second field on the frontend |

**Success Response** `200 OK`:

```json
{
  "success": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Description |
|:---|:---|:---|
| `sessionToken` | string | JWT for authenticating the guest in the session room (8-hour TTL) |

After success, the frontend shows M06 "Welcome" (teal, auto-advances to session after 2.8 s).

**Error Responses:**

| Status | Body | Trigger |
|:---|:---|:---|
| `400 Bad Request` | `{ "success": false, "error": "validation_error", "fields": { "email": "Please enter a valid email address" } }` | Invalid or missing fields |
| `404 Not Found` | `{ "success": false, "error": "group_not_found" }` | `groupId` doesn't exist |
| `410 Gone` | `{ "success": false, "error": "session_not_live" }` | No live session for this group |

---

## 7. Data Structures

### Participant

```json
{
  "id": "u-011",
  "initials": "EO",
  "name": "Elias Ocasio"
}
```

| Field | Type | Description |
|:---|:---|:---|
| `id` | string | User ID |
| `initials` | string | 1–2 characters for avatar circle |
| `name` | string | Full name (accessibility / tooltip) |

### ZoneSession

```json
{
  "id": "gs1",
  "title": "The Good Soil",
  "leader": "Elias Ocasio",
  "church": "Life Church",
  "lifecycle": "live",
  "start": 1719203040000,
  "startedAgo": 360000,
  "inRoom": 8,
  "endedAgo": null,
  "participants": [
    { "id": "u-011", "initials": "EO", "name": "Elias Ocasio" }
  ]
}
```

| Field | Type | When Present | Description |
|:---|:---|:---|:---|
| `id` | string | Always | Stable session identifier |
| `title` | string | Always | Study/series name |
| `leader` | string | Always | Full name of the group leader |
| `church` | string | Always | Congregation name |
| `lifecycle` | `"live"` \| `"soon"` \| `"finished"` | Always | Current lifecycle state |
| `start` | number | Always | Unix timestamp ms |
| `startedAgo` | number | `live` | Millis since session started |
| `inRoom` | number | `live` | Count of people in the room |
| `participants` | Participant[] | `live` | Visible participants for avatars |
| `endedAgo` | number | `finished` | Millis since session ended |

### PastSession

```json
{
  "id": "gs0",
  "title": "The Good Soil",
  "leader": "Elias Ocasio",
  "church": "Life Church",
  "start": 1718595840000,
  "attended": true,
  "notesUrl": "https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c"
}
```

| Field | Type | Description |
|:---|:---|:---|
| `id` | string | Stable session identifier |
| `title` | string | Study/series name |
| `leader` | string | Leader's full name |
| `church` | string | Congregation name |
| `start` | number | Unix timestamp ms |
| `attended` | boolean | Whether the user attended this session |
| `notesUrl` | string | Read-only URL for study notes/recap |

---

## 8. Error Reference

All error responses follow this envelope:

```json
{
  "success": false,
  "error": "error_code",
  "fields": {}
}
```

| HTTP Status | `error` Code | Meaning |
|:---|:---|:---|
| `400` | `validation_error` | Missing or malformed request fields. Check `fields` for details. |
| `401` | `invalid_credentials` | Wrong email or password (login endpoint — message is generic). |
| `401` | `not_authenticated` | No valid session cookie or token. |
| `401` | `invalid_code` | Wrong SMS verification code. |
| `403` | `incorrect_password` | Current password is wrong (settings password change). |
| `403` | `invalid_passcode` | Room passcode is wrong. |
| `404` | `group_not_found` | `groupId` doesn't exist. |
| `404` | `session_not_found` | `sessionId` doesn't exist. |
| `404` | `room_not_found` | Room ID doesn't exist. |
| `404` | `code_not_recognized` | Join code or group code doesn't match anything. |
| `404` | `token_invalid` | Reset token not found or malformed. |
| `409` | `already_joined` | User is already in the session. |
| `409` | `already_member` | User is already a member of the group. |
| `409` | `email_taken` | Email address is already registered to another account. |
| `409` | `token_used` | Reset token was already consumed. |
| `410` | `token_expired` | Reset token TTL exceeded. |
| `410` | `code_expired` | SMS verification code TTL exceeded. |
| `410` | `session_ended` | The session is no longer active. |
| `410` | `session_not_live` | No live session for the requested group. |
| `429` | `rate_limited` | Too many attempts. Retry later. |
| `500` | `email_failed` | SMTP delivery failure (logged; user sees confirmation screen). |

---

## Appendix: Frontend Cookie Behavior

The frontend manages a lightweight cookie for join-flow personalization:

| Property | Value |
|:---|:---|
| **Name** | `bd_session` |
| **Value** | URL-encoded JSON: `{"name":"Jordan Smith","userId":"u-dev-001"}` |
| **Max-Age** | 2,592,000 seconds (30 days) |
| **Path** | `/` |
| **SameSite** | `Lax` |

This cookie is **presentation-only** — it powers the "Welcome back, [name]" screen (M00a/M00b) and "Not you?" functionality. The backend's session cookie for authentication is separate and handled via standard `Set-Cookie` headers with `HttpOnly` and `Secure` flags.

---

## Appendix: Join Flow Modal Mapping

For reference, the 14 modals (M00a–M12) and their API dependencies:

| Modal | Color | API Call | Description |
|:---|:---|:---|:---|
| M00a | Orange | _(cookie)_ | Welcome back — live session detected |
| M00b | Neutral | _(cookie)_ | Welcome back — no live session |
| M01 | Orange | → M04/M02 | Live entry — sign in / create / guest |
| M02 | Orange | → M05/M03 | Not in group — register or join as guest |
| M03 | Orange | `POST /guest/join` | Guest form — name + email |
| M04 | Teal | _(auto-adv)_ | Welcome back — joining session |
| M05 | Teal | _(auto-adv)_ | You're all set — registered + joining |
| M06 | Teal | _(auto-adv)_ | Welcome — guest joining |
| M07 | Neutral | → M08/M09 | No-live entry — sign in / create / later |
| M08 | Neutral | — | Nothing live — go to dashboard |
| M09 | Neutral | `POST /groups/:groupId/register` | Register for group (no-live) |
| M10 | Neutral | — | Nothing live (after "maybe later") |
| M11 | Neutral | — | Nothing live (no account) |
| M12 | Teal | — | You're now a member |

---

*Generated from reverse-engineering `BibleDoseApp/js/*`, `BibleDoseApp/*.html`, and `bibledose-join-flow-docs.md`.*