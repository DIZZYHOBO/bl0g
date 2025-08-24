import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PostEditor from '../components/PostEditor';
import { useAuth } from '../hooks/useAuth';

export default function Admin() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [selectedPost, setSelectedPost] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center mt-20">Loading...</div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Blog Admin</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm opacity-60">
              Logged in as {user.username}@{user.instance}
            </div>
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-700"
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
              className="w-full bg-primary text-white p-3 rounded mb-4 hover:bg-primary/80"
            >
              📝 New Post to Lemmy
            </button>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Popular Communities</h3>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <div>programming@lemmy.ml</div>
                <div>technology@lemmy.world</div>
                <div>opensource@lemmy.ml</div>
                <div>selfhosted@lemmy.world</div>
              </div>
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
              <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
                <h3 className="text-xl mb-4">Welcome to Your Blog Admin</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create new posts and share them directly to Lemmy communities.
                </p>
                <button
                  onClick={() => setSelectedPost({ title: '', content: '', community: '', url: '', isNew: true })}
                  className="bg-primary text-white px-6 py-2 rounded hover:bg-primary/80"
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
