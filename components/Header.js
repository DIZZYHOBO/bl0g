import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';

export default function Header({ name, onPostCreated }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="pt-20 pb-12">
      <div className="block w-12 h-12 mx-auto mb-4 rounded-full bg-conic-180 from-gradient-3 from-0% to-gradient-4 to-100%" />
      <p className="text-2xl text-center dark:text-white">
        <Link href="/">{name}</Link>
      </p>
      
      {/* Minimal auth status - only show when authenticated */}
      {mounted && isAuthenticated && (
        <div className="flex justify-center gap-3 mt-6 text-sm">
          <Link 
            href="/admin"
            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
          >
            Dashboard
          </Link>
          <button
            onClick={() => {
              if (onPostCreated) {
                sessionStorage.setItem('postCreatedCallback', 'true');
              }
              window.location.href = '/admin?newPost=true&returnHome=true';
            }}
            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
          >
            New Post
          </button>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
      
      {/* Show login link only when not authenticated */}
      {mounted && !isAuthenticated && (
        <div className="flex justify-center mt-6">
          <Link 
            href="/login"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
          >
            Login
          </Link>
        </div>
      )}
    </header>
  );
}
