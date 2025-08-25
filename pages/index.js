import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

import Footer from '../components/Footer';
import Header from '../components/Header';
import Layout, { GradientBackground } from '../components/Layout';
import ArrowIcon from '../components/ArrowIcon';
import { getGlobalData } from '../utils/global-data';
import SEO from '../components/SEO';

export default function Index({ globalData }) {
  const { isAuthenticated, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load posts from API
  const loadPosts = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      const response = await fetch(`/.netlify/functions/api-posts-db?page=${pageNum}&limit=10`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const newPosts = data.data.posts.map(post => ({
          ...post,
          filePath: `${post.slug}.mdx`,
          data: {
            title: post.title,
            description: post.description,
            content_preview: post.content_preview,
            date: new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long', 
              day: 'numeric'
            }),
            author: post.author,
            tags: post.tags,
            read_time: post.read_time,
            word_count: post.word_count
          }
        }));
        
        if (append) {
          setPosts(prev => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }
        
        setHasMore(data.data.pagination.has_next);
      } else {
        setError(data.message || 'Failed to load posts');
      }
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Load posts on mount
  useEffect(() => {
    if (mounted) {
      loadPosts();
    }
  }, [mounted]);

  // Refresh posts
  const refreshPosts = () => {
    setPage(1);
    loadPosts(1, false);
  };

  // Load more posts
  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(nextPage, true);
  };

  return (
    <Layout>
      <SEO title={globalData.name} description={globalData.blogTitle} />
      <Header name={globalData.name} onPostCreated={refreshPosts} />
      <main className="w-full">
        <h1 className="mb-12 text-3xl text-center lg:text-5xl">
          {globalData.blogTitle}
        </h1>

        {/* Loading State */}
        {loading && posts.length === 0 && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <div>Loading posts...</div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && posts.length === 0 && (
          <div className="mb-8 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg text-center">
            <div className="font-medium mb-2">Unable to load posts</div>
            <div className="text-sm mb-3">{error}</div>
            <button 
              onClick={() => loadPosts()} 
              className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Blog Posts List */}
        {posts.length > 0 && (
          <ul className="w-full space-y-1">
            {posts.map((post, index) => (
              <li
                key={`${post.slug}-${index}`}
                className="transition border border-b-0 bg-white/10 border-gray-800/10 md:first:rounded-t-lg backdrop-blur-lg dark:bg-black/30 hover:bg-white/20 dark:hover:bg-black/50 dark:border-white/10 last:border-b last:rounded-b-lg"
              >
                <Link
                  href={`/posts/${post.slug}`}
                  className="block px-6 py-6 lg:py-10 lg:px-16 focus:outline-hidden focus:ring-4 focus:ring-primary/50"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      {post.data.date && (
                        <p className="mb-1 text-sm font-bold uppercase opacity-60">
                          {post.data.date}
                        </p>
                      )}
                      {post.data.author && (
                        <p className="text-sm text-primary font-medium">
                          By {post.data.author}
                        </p>
                      )}
                    </div>
                    {post.data.tags && post.data.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {post.data.tags.slice(0, 3).map((tag, i) => (
                          <span 
                            key={i}
                            className="px-2 py-1 text-xs bg-primary/20 text-primary rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {post.data.tags.length > 3 && (
                          <span className="text-xs opacity-60">+{post.data.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl mb-3">
                    {post.data.title}
                  </h2>
                  
                  {/* Show description or content preview */}
                  {(post.data.description || post.data.content_preview || post.content_preview) && (
                    <p className="text-lg opacity-60 mb-4 line-clamp-3">
                      {post.data.description || post.data.content_preview || post.content_preview}
                    </p>
                  )}
                  
                  {/* Show read time and word count */}
                  <div className="flex gap-4 text-sm opacity-50 mb-4">
                    {post.data.read_time && (
                      <span>📖 {post.data.read_time} min read</span>
                    )}
                    {post.data.word_count && (
                      <span>📝 {post.data.word_count} words</span>
                    )}
                  </div>
                  
                  <ArrowIcon className="mt-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Load More Button */}
        {hasMore && posts.length > 0 && !loading && (
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 disabled:opacity-50 transition-colors font-medium"
            >
              Load More Posts
            </button>
          </div>
        )}

        {/* Empty State - Simple */}
        {posts.length === 0 && !loading && !error && (
          <div className="text-center py-16">
            <h3 className="text-2xl font-semibold mb-4 opacity-60">No posts yet</h3>
            {mounted && isAuthenticated && (
              <Link
                href="/admin?newPost=true"
                className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors font-medium"
              >
                Write First Post
              </Link>
            )}
          </div>
        )}
      </main>
      <Footer copyrightText={globalData.footerText} />
      <GradientBackground
        variant="large"
        className="fixed top-20 opacity-40 dark:opacity-60"
      />
      <GradientBackground
        variant="small"
        className="absolute bottom-0 opacity-20 dark:opacity-10"
      />
    </Layout>
  );
}

export function getStaticProps() {
  const globalData = getGlobalData();
  return { props: { globalData } };
}
