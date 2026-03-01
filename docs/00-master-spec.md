# 00 - Master Specification: Film Analyzer

## Product Mission
To empower content creators and translators by providing an AI-driven platform that streamlines the process of analyzing Chinese films, predicting their success on Vietnamese YouTube markets, and managing the production lifecycle from research to publication.

## Target Users
- **Vietnamese YouTube Creators**: Specifically those focusing on "Vietsub" (Vietnamese subtitled) content.
- **Film Translators**: Professionals looking to identify high-potential content for localization.
- **Content Strategists**: Teams managing multiple channels and production pipelines.

## Core Features
- **Film Submission**: Upload film posters, input Chinese titles, and provide episode summaries.
- **AI Translation**: Automatic translation of Chinese titles into natural, SEO-friendly Vietnamese.
- **Potential Analysis**: AI-driven scoring of how well a film might perform as a "Vietsub" project on YouTube.
- **SEO Recommendations**: Suggested keywords, descriptions, and title variations for the Vietnamese market.
- **Production Tracker**: A centralized dashboard to monitor the status of various film projects.
- **Data Persistence**: Secure storage of all analyses and progress in Firebase.

## User Flow
1. **Input**: User enters film details (Image URL/Upload, Chinese Title, Summary).
2. **Analysis**: User triggers "Analyze" which calls the Gemini AI.
3. **Review**: User reviews the Vietnamese title, potential score, and SEO tips.
4. **Save**: User saves the project to the dashboard.
5. **Track**: User updates the project status as it moves through the production pipeline.

## Status Workflow
Projects follow a linear progression:
- **Researching**: Initial phase where the film is being evaluated.
- **Editing**: The translation or subtitling process is underway.
- **Uploaded**: Content is on YouTube but perhaps scheduled or private.
- **Done**: Content is public and the project is considered complete.

## MVP Scope
- Web-based UI for data entry and dashboard.
- Integration with Gemini API for translation and analysis.
- Firebase Authentication and Firestore for data storage.
- Basic status management (Researching -> Done).

## Out of Scope
- Automated video downloading or editing.
- Direct YouTube API integration for auto-uploading.
- Social media sharing features.
- Multi-language support (beyond Chinese to Vietnamese).

## Roadmap Phases
- **Phase 1**: Core AI analysis and Firebase integration (MVP).
- **Phase 2**: Image-to-text (OCR) for posters to auto-fill Chinese titles.
- **Phase 3**: Batch processing of multiple films.
- **Phase 4**: Advanced analytics dashboard tracking YouTube performance (manual entry).

## Success Metrics
- **Time Saved**: Reduction in time spent researching and translating film titles.
- **Accuracy**: User satisfaction with AI-generated Vietnamese titles.
- **Engagement**: Number of projects successfully moved to "Done" status.
- **System Uptime**: Reliability of AI and Database integrations.
