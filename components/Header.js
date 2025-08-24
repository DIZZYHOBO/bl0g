import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';

export default function Header({ name, onPostCreated }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleQuickPost = () => {
    // Store callback for after post creation
    if (onPostCreated) {
      sessionStorage.setItem('postCreatedCallback', 'true');
    }
    window.location.href = '/admin?newPost=true&returnHome=true';
  };

  return (
    <header className="pt-20 pb-12">
      <div className="block w-12 h-12 mx-auto mb-4 rounded-full bg-conic-180 from-gradient-3 from-0% to-gradient-4 to-100%" />
      <p className="text-2xl text-center dark:text-white mb-4">
        <Link href="/">{name}</Link>
      </p>
      
      {/* Auth Navigation */}
      {mounted && (
        <div className="flex justify-center gap-3 mt-6 flex-wrap">
          {isAuthenticated ? (
            <>
              <Link 
                href="/admin"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors text-sm font-medium"
              >
                📊 Dashboard
              </Link>
              <button
                onClick={handleQuickPost}
                className="px-4 py-2 bg-gradient-to-r from-gradient-1 to-gradient-2 text-white rounded-lg hover:opacity-80 transition-opacity text-sm font-medium"
              >
                ✍️ Quick Post
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg rounded-lg border border-gray-200/20">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {user?.display_name || user?.username}@{user?.instance}
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-red-500 hover:text-red-700 underline ml-2"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <Link 
              href="/login"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors text-sm font-medium"
            >
              🚀 Login with Lemmy
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
