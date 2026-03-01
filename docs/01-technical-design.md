# 01 - Technical Design: Film Analyzer

## System Architecture Diagram
```text
+-----------------------+      +-----------------------+      +-----------------------+
|                       |      |                       |      |                       |
|   React Frontend      | <--> |   Firebase Auth       |      |   Gemini AI API       |
|   (Vite + Tailwind)   |      |   (User Identity)     |      |   (Analysis & Trans)  |
|                       |      |                       |      |                       |
+-----------^-----------+      +-----------^-----------+      +-----------^-----------+
            |                              |                              |
            |                              |                              |
            v                              v                              v
+-----------------------+      +-----------------------+      +-----------------------+
|                       |      |                       |      |                       |
|   Firestore Database  | <--> |   Firebase Storage    |      |   Cloud Functions     |
|   (Project Data)      |      |   (Film Posters)      |      |   (Optional Backend)  |
|                       |      |                       |      |                       |
+-----------------------+      +-----------------------+      +-----------------------+
```

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Motion (for animations).
- **Backend/Database**: Firebase (Firestore, Authentication, Storage).
- **AI Engine**: Gemini 3 Flash (for fast, cost-effective analysis and translation).
- **Hosting**: Google Cloud Run (via AI Studio environment).

## Firestore Schema Design
### Collection: `projects`
- `id`: string (auto-generated)
- `userId`: string (Firebase Auth UID)
- `chineseTitle`: string
- `vietnameseTitle`: string
- `posterUrl`: string
- `summary`: string
- `potentialScore`: number (0-10)
- `seoKeywords`: array<string>
- `seoDescription`: string
- `status`: enum ("researching", "editing", "uploaded", "done")
- `createdAt`: timestamp
- `updatedAt`: timestamp

## Document Structure
- `/docs`: Documentation (Markdown).
- `/src/components`: Reusable UI components (Button, Card, Input).
- `/src/services`: API wrappers for Firebase and Gemini.
- `/src/hooks`: Custom React hooks for data fetching and state management.
- `/src/types.ts`: TypeScript interfaces for project data and AI responses.

## Security Considerations
- **Firebase Security Rules**: Ensure users can only read/write their own data.
- **API Key Management**: Gemini API keys must be stored in environment variables (`process.env.GEMINI_API_KEY`).
- **Input Sanitization**: Validate all user inputs before sending to AI or Firestore.
- **CORS**: Properly configure allowed origins for API calls.

## AI Call Flow
1. **Trigger**: User clicks "Analyze".
2. **Payload**: Frontend constructs a prompt with Chinese title and summary.
3. **Request**: Frontend calls `ai.models.generateContent` with Gemini 3 Flash.
4. **Response**: AI returns a JSON-formatted string.
5. **Parsing**: Frontend parses JSON and updates the UI state.
6. **Persistence**: User reviews and saves the data to Firestore.

## Error Handling
- **AI Failures**: Implement retries for transient network errors. Show user-friendly messages for invalid inputs.
- **Firebase Failures**: Handle permission denied or connectivity issues with toast notifications.
- **Validation**: Ensure required fields (Title, Summary) are present before calling the AI.

## Deployment Strategy
- **Development**: Local development using Vite and Firebase Emulators (optional).
- **Production**: Build with `npm run build` and serve via the AI Studio reverse proxy on port 3000.
- **Environment**: Use `.env.example` to document required keys.
