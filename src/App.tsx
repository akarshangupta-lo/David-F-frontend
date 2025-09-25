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
              </div>
            </div>
            <GoogleSignIn />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <WineOcrWizard />
        </div>
      </main>

      {/* Footer removed */}
    </div>
  );
}

export default App;