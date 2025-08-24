import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function LemmyLogin() {
  const { login, loading: authLoading, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [credentials, setCredentials] = useState({
    instance: 'lemmy.ml',
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push('/admin');
    }
  }, [mounted, isAuthenticated, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(
        credentials.instance,
        credentials.username,
        credentials.password
      );

      if (result.success) {
        router.push('/admin');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state during hydration
  if (!mounted || authLoading) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // Don't show login form if already authenticated
  if (isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center">Redirecting to admin...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">Login to Lemmy</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Instance</label>
          <input
            type="text"
            placeholder="lemmy.ml"
            value={credentials.instance}
            onChange={(e) => setCredentials({...credentials, instance: e.target.value})}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">Do not include https://</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white p-2 rounded hover:bg-primary/80 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      <div className="mt-4 text-sm text-gray-500 text-center">
        <p>Enter your Lemmy instance credentials to start posting.</p>
      </div>
    </div>
  );
}
