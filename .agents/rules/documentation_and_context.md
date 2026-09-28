# Documentation & Context Window Conservation Rule

## Invariant 1: Research & Audit Documentation
- NEVER dump long-form code audits, deep architectural investigations, or massive technical reports directly into the chat message.
- ALWAYS write these into structured Markdown artifacts inside the artifact directory (`<appDataDir>/brain/<conversation-id>/`).
- In the chatbox, provide only a high-level summary (bullet points) and a direct file link to the artifact (e.g. `[audit_report.md](file:///path/to/artifact.md)`).

## Invariant 2: Context Window Conservation
- Keep conversational responses concise and targeted.
- Do not repeat file contents or re-summarize entire artifacts that were just written.

## Invariant 3: Language Preference
- Communicate with the user in Bengali (বাংলা) unless requested otherwise, keeping technical terms clear and accurate.
