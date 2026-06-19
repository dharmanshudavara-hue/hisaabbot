# HisaabBot

**A voice-first, AI-powered loan and expense tracker for people who cannot read or write.**

HisaabBot is designed to be the financial memory that non-literate individuals never had. It allows users to track their informal loans ("Udhar Khata") and daily expenses entirely by speaking in their native language (e.g., Hindi, Gujarati). No reading or typing is required.

## Key Features

- ** Voice-First Interface:** Users press a large microphone button and speak naturally (e.g., "Ramesh ko 500 rupaye diye").
- ** AI Intent Extraction:** Uses LLMs to automatically parse names, amounts, and transaction types from unstructured speech.
- ** Audio Confirmations:** The app speaks back confirmations so the user knows the transaction was recorded correctly.
- ** Udhar Khata (Loan Tracker):** Track who borrowed money and who you owe.
- ** Expense Tracking:** Log daily expenses and get auto-categorized summaries.


## Tech Stack

- **Frontend:** Next.js (React), Progressive Web App (PWA)
- **AI Processing:** Groq Llama 3.1 API (for intent extraction)
- **Voice Capabilities:** Native browser Web Speech API (STT) and SpeechSynthesis API (TTS)
- **Database:** Supabase (PostgreSQL)


## License

MIT License
