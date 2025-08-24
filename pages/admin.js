import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

// Dynamically import PostEditor to avoid SSR issues
const PostEditor = dynamic(() => import('../components/PostEditor'), {
  ssr: false,
  loading: () => <div className="text-center">Loading editor...</div>
});

export default function Admin() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [selectedPost, setSelectedPost] = useState(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle newPost URL parameter
  useEffect(() => {
    if (mounted && router.query.newPost === 'true' && isAuthenticated) {
      setSelectedPost({ 
        title: '', 
        content: '', 
        community: '', 
        url: '', 
        isNew: true 
      });
      // Clean up URL
      router.replace('/admin', undefined, { shallow: true });
    }
  }, [mounted, router.query.newPost, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, mounted, router]);

  if (!mounted || loading) {
    return (
      <Layout>
        <div className="text-center mt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div>Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="text-center mt-20">Redirecting to login...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Blog Admin</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm opacity-60">
              Logged in as {user?.username}@{user?.instance}
            </div>
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-700 underline"
            >
              Logout
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <button
              onClick={() => setSelectedPost({ title: '', content: '', community: '', url: '', isNew: true })}
              className="w-full bg-primary text-white p-3 rounded mb-4 hover:bg-primary/80 transition-colors"
            >
              📝 New Post to Lemmy
            </button>
            
            <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg p-4 rounded-lg shadow border border-gray-200/20">
              <h3 className="font-semibold mb-2">Popular Communities</h3>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <div className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
                     onClick={() => setSelectedPost({ 
                       title: '', content: '', community: 'programming@lemmy.ml', url: '', isNew: true 
                     })}>
                  programming@lemmy.ml
                </div>
                <div className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
                     onClick={() => setSelectedPost({ 
                       title: '', content: '', community: 'technology@lemmy.world', url: '', isNew: true 
                     })}>
                  technology@lemmy.world
                </div>
                <div className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
                     onClick={() => setSelectedPost({ 
                       title: '', content: '', community: 'opensource@lemmy.ml', url: '', isNew: true 
                     })}>
                  opensource@lemmy.ml
                </div>
                <div className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
                     onClick={() => setSelectedPost({ 
                       title: '', content: '', community: 'selfhosted@lemmy.world', url: '', isNew: true 
                     })}>
                  selfhosted@lemmy.world
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Click to quick-select</p>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            {selectedPost ? (
              <PostEditor
                post={selectedPost}
                onSave={() => {
                  setSelectedPost(null);
                }}
                onCancel={() => setSelectedPost(null)}
              />
            ) : (
              <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg p-8 rounded-lg shadow text-center border border-gray-200/20">
                <div className="text-4xl mb-4">🚀</div>
                <h3 className="text-xl mb-4">Welcome to Your Blog Admin</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create new posts and share them directly to Lemmy communities.
                  Connect your blog audience with the broader Lemmy ecosystem!
                </p>
                <button
                  onClick={() => setSelectedPost({ title: '', content: '', community: '', url: '', isNew: true })}
                  className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/80 transition-colors font-medium"
                >
                  Create Your First Post
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
