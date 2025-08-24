import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import SEO from '../components/SEO';
import { getGlobalData } from '../utils/global-data';

// Dynamically import PostEditor to avoid SSR issues
const PostEditor = dynamic(() => import('../components/PostEditor'), {
  ssr: false,
  loading: () => <div className="text-center p-8">Loading editor...</div>
});

export default function Admin({ globalData }) {
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
      // Clean up URL without triggering navigation
      const url = new URL(window.location);
      url.searchParams.delete('newPost');
      window.history.replaceState({}, '', url);
    }
  }, [mounted, router.query.newPost, isAuthenticated]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, mounted, router]);

  // Show loading while checking auth
  if (!mounted || loading) {
    return (
      <Layout>
        <SEO title={`Admin - ${globalData.name}`} description="Blog administration" />
        <div className="text-center mt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div>Loading admin panel...</div>
        </div>
      </Layout>
    );
  }

  // Show redirecting message
  if (!isAuthenticated) {
    return (
      <Layout>
        <SEO title={`Admin - ${globalData.name}`} description="Blog administration" />
        <div className="text-center mt-20">
          <div className="text-lg mb-4">🔐</div>
          <div>Redirecting to login...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title={`Admin - ${globalData.name}`} description="Blog administration" />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Blog Admin</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your blog posts and content
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm opacity-60 text-right">
              <div className="font-medium">{user?.display_name || user?.username}</div>
              <div className="text-xs">{user?.instance}</div>
            </div>
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-700 underline whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            
            {/* New Post Button */}
            <button
              onClick={() => setSelectedPost({ 
                title: '', 
                content: '', 
                community: '', 
                url: '', 
                isNew: true 
              })}
              className="w-full bg-primary text-white p-3 rounded-lg mb-4 hover:bg-primary/80 transition-colors font-medium"
            >
              📝 Create New Post
            </button>

            {/* Back to Home */}
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-500 text-white p-3 rounded-lg mb-6 hover:bg-gray-400 transition-colors font-medium"
            >
              🏠 Back to Home
            </button>
            
            {/* Popular Communities Suggestion */}
            <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg p-4 rounded-lg shadow border border-gray-200/20">
              <h3 className="font-semibold mb-2">Suggested Tags</h3>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <div 
                  className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer p-1 rounded hover:bg-white/10"
                  onClick={() => setSelectedPost({ 
                    title: '', 
                    content: '', 
                    tags: 'programming, tutorial',
                    description: '', 
                    isNew: true 
                  })}
                >
                  programming, tutorial
                </div>
                <div 
                  className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer p-1 rounded hover:bg-white/10"
                  onClick={() => setSelectedPost({ 
                    title: '', 
                    content: '', 
                    tags: 'technology, news',
                    description: '', 
                    isNew: true 
                  })}
                >
                  technology, news
                </div>
                <div 
                  className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer p-1 rounded hover:bg-white/10"
                  onClick={() => setSelectedPost({ 
                    title: '', 
                    content: '', 
                    tags: 'opensource, development',
                    description: '', 
                    isNew: true 
                  })}
                >
                  opensource, development
                </div>
                <div 
                  className="hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer p-1 rounded hover:bg-white/10"
                  onClick={() => setSelectedPost({ 
                    title: '', 
                    content: '', 
                    tags: 'selfhosted, homelab',
                    description: '', 
                    isNew: true 
                  })}
                >
                  selfhosted, homelab
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Click to quick-start with tags</p>
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
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl mb-4">Welcome to Your Blog Admin</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Ready to share your thoughts with the community? 
                  Create a new blog post and contribute to the conversation.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedPost({ 
                      title: '', 
                      content: '', 
                      community: '', 
                      url: '', 
                      isNew: true 
                    })}
                    className="block w-full sm:inline-block sm:w-auto bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/80 transition-colors font-medium"
                  >
                    Create Your First Post
                  </button>
                  <div className="text-sm text-gray-500">
                    or <button 
                      onClick={() => router.push('/')}
                      className="text-primary hover:underline"
                    >
                      browse community posts
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export function getStaticProps() {
  const globalData = getGlobalData();
  return { props: { globalData } };
}
