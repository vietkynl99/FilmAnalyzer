# Film Analyzer MVP

An AI-powered platform for content creators to analyze Chinese films, predict their success on the Vietnamese YouTube market, and manage their production workflow.

## 🚀 Features

- **AI Film Analysis**: Uses Gemini 3 Flash to translate Chinese titles and score their potential for the Vietnamese market.
- **Production Dashboard**: Real-time tracking of film projects from research to completion.
- **Firebase Integration**: Powered by Firebase Realtime Database for instant data synchronization.
- **System Health Monitor**: A dedicated settings panel to monitor database connectivity and sync status.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons.
- **Database**: Firebase Realtime Database.
- **AI Engine**: Google Gemini 3 Flash.
- **Hosting**: Google Cloud Run.

## ⚙️ Configuration

The application is configured via environment variables. Create a `.env` file based on `.env.example`:

```env
# Gemini AI
GEMINI_API_KEY="your_gemini_api_key"

# Firebase Configuration
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
VITE_FIREBASE_DATABASE_URL="https://your_project.firebaseio.com"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
```

### 📦 Firebase Setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Add a **Web App** to your project and copy the configuration keys.
3. Enable **Realtime Database** in your project.
4. Set the **Security Rules** to allow read/write access (ensure proper authentication in production):
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```
5. Add the configuration keys to your environment variables.

## 📊 Database Status Monitor

The **Settings** page provides a read-only view of the system's health:
- **Connection Status**: Real-time indicator (Connected / Error).
- **Infrastructure Details**: View Project ID, Database URL, and Region.
- **Sync Tracking**: Monitor the "Last Successful Sync" time to ensure data is up to date.

*Note: Database credentials cannot be modified from the UI for security reasons.*

## 🔍 Troubleshooting

### White Screen on Startup
- Ensure all `VITE_FIREBASE_*` environment variables are correctly set.
- Check the browser console for any initialization errors.

### Firebase Not Connected
- Verify your `VITE_FIREBASE_DATABASE_URL` matches the one in the Firebase Console.
- Ensure your network allows connections to Firebase (check firewall/VPN).

### Permission Denied (403 Error)
- Check your Firebase Realtime Database Security Rules.
- Ensure the user is properly authenticated if rules require `auth != null`.

## 📄 Documentation

Detailed documentation can be found in the `/docs` folder:
- [Master Specification](./docs/00-master-spec.md)
- [Technical Design](./docs/01-technical-design.md)
- [AI Design](./docs/02-ai-design.md)
