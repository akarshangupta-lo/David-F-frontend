# Wine Label Processor

A sophisticated frontend application for processing wine labels through OCR and AI matching, integrated with Google Drive storage.

## Features

- **Google OAuth Authentication**: Secure sign-in with Google Drive integration
- **Batch Upload**: Process up to 100 wine label images simultaneously
- **Real-time Processing**: Live status updates for each file through the pipeline
- **AI-Powered Matching**: Gemini AI provides top 3 wine matches with reasoning
- **Human Review Options**: NHR (Need Human Review) with categorized rejection reasons
- **Editable Results**: Manual correction of OCR text and final outputs
- **Google Drive Integration**: Automatic file storage and organization
- **Export Capabilities**: CSV/Excel export of processing results
- **Responsive Design**: Optimized for desktop and mobile viewing

## Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Icons**: Lucide React
- **Authentication**: Google OAuth 2.0
- **File Upload**: Drag-and-drop with validation
- **Real-time Updates**: Server-Sent Events (SSE)
- **Backend Integration**: FastAPI REST APIs

## Getting Started

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your Google OAuth client ID and backend URL.

3. **Development**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   ```

## API Integration

The frontend communicates with a FastAPI backend through these endpoints:

- `POST /auth/google` - Google OAuth authentication
- `POST /upload` - Batch file upload
- `GET /status/{file_id}` - Real-time processing updates (SSE)
- `POST /save` - Save approved results to Drive
- `POST /retry/{file_id}` - Retry failed processing
- `GET /export` - Export results as CSV

## Processing Pipeline

1. **Authentication**: Google sign-in with Drive permissions
2. **Upload**: Drag-and-drop up to 100 images
3. **OCR**: Extract text from wine labels
4. **AI Matching**: Gemini provides top 3 matches + reasoning
5. **Review**: Human approval with editing capabilities
6. **Storage**: Save to organized Google Drive folders

## File Organization

```
src/
├── components/          # React components
│   ├── GoogleSignIn.tsx    # Authentication
│   ├── FileUploadZone.tsx  # File upload interface
│   ├── ProcessingTable.tsx # Results table
│   └── ActionBar.tsx       # Action controls
├── hooks/              # Custom hooks
│   ├── useAuth.ts         # Authentication logic
│   └── useFileProcessing.ts # File processing state
├── types/              # TypeScript definitions
└── App.tsx            # Main application
```

## Design System

- **Colors**: Wine-themed palette with burgundy primary (#7C2D12)
- **Typography**: Inter font family with proper hierarchy
- **Spacing**: 8px grid system for consistent alignment
- **Components**: Tailwind CSS with custom wine industry styling
- **Animations**: Smooth transitions and micro-interactions

## Security Features

- Google OAuth 2.0 authentication
- File type and size validation
- CORS-enabled API communication
- Secure token management
- Input sanitization and validation

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with modern JavaScript support

## Contributing

1. Follow the existing code style and conventions
2. Ensure responsive design across all viewport sizes
3. Maintain TypeScript type safety
4. Test with multiple file upload scenarios
5. Verify Google OAuth integration

## License

This project is part of a fullstack wine processing application with FastAPI backend integration.