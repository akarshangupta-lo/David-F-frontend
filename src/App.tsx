import React from 'react';
import { Wine } from 'lucide-react';
import { GoogleSignIn } from './components/GoogleSignIn';
import { useAuth } from './hooks/useAuth';
import { WineOcrWizard } from './components/WineOcrWizard';

function App() {
  const { user } = useAuth();

  if (!user) {
    return <GoogleSignIn />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-red-900 rounded-lg flex items-center justify-center">
                <Wine className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Wine Label Processor</h1>
                <p className="text-xs text-gray-500">OCR • AI Matching • Google Drive Integration</p>
              </div>
            </div>
            <GoogleSignIn />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Wine OCR Workflow</h2>
            <p className="text-gray-600">
              Upload images, process OCR, match products, and review results.
            </p>
          </div>

          <WineOcrWizard />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Wine className="h-4 w-4" />
              <span>Powered by FastAPI • Google Drive • Gemini AI</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Secure wine label processing with enterprise-grade OCR and AI matching
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;