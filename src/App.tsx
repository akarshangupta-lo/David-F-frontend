import { Wine } from 'lucide-react';
import { GoogleSignIn } from './components/GoogleSignIn';
import { useAuth } from './hooks/useAuth';
import { WineOcrWizard } from './components/WineOcrWizard';

function App() {
  const { user, signOut } = useAuth();

  if (!user) {
    return <GoogleSignIn />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
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
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={signOut}
                className="px-4 py-2 text-sm font-medium text-red-700 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Add top padding to account for fixed header */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
        <div className="space-y-8">
          <WineOcrWizard />
        </div>
      </main>
    </div>
  );
}

export default App;