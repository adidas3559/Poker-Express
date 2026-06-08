---
name: feedback_sessionStorage
description: User prefers not to read from sessionStorage unless there is no other option
metadata:
  type: feedback
---

Avoid using sessionStorage as a fallback unless it is the only viable option.

**Why:** User prefers FE components to rely on props, navigation state, or live socket data rather than sessionStorage reads. sessionStorage is a last resort, not a convenience.

**How to apply:** When suggesting FE patterns, prefer passing data explicitly (via state, context, or socket payloads) over reading sessionStorage. Only suggest sessionStorage reads when the data is genuinely unavailable any other way (e.g., surviving a full page refresh).
