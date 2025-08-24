import Link from 'next/link';
import { getPosts } from '../utils/mdx-utils';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';

import Footer from '../components/Footer';
import Header from '../components/Header';
import Layout, { GradientBackground } from '../components/Layout';
import ArrowIcon from '../components/ArrowIcon';
import { getGlobalData } from '../utils/global-data';
import SEO from '../components/SEO';

export default function Index({ posts, globalData }) {
  const { isAuthenticated, user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Layout>
      <SEO title={globalData.name} description={globalData.blogTitle} />
      <Header name={globalData.name} />
      <main className="w-full">
        <h1 className="mb-8 text-3xl text-center lg:text-5xl">
          {globalData.blogTitle}
        </h1>

        {/* Quick Action Bar for Authenticated Users */}
        {mounted && isAuthenticated && (
          <div className="mb-8 p-4 bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg rounded-lg border border-gray-200/20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Welcome back, {user?.username}!</span>
                <span className="block sm:inline sm:ml-2">Ready to share your thoughts with Lemmy?</span>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/admin?newPost=true"
                  className="px-4 py-2 bg-gradient-to-r from-gradient-1 to-gradient-2 text-white rounded-lg hover:opacity-80 transition-opacity text-sm font-medium whitespace-nowrap"
                >
                  ✍️ New Post
                </Link>
                <Link
                  href="/admin"
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  📊 Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Blog Posts List */}
        <ul className="w-full">
          {posts.map((post) => (
            <li
              key={post.filePath}
              className="transition border border-b-0 bg-white/10 border-gray-800/10 md:first:rounded-t-lg md:last:rounded-b-lg backdrop-blur-lg dark:bg-black/30 hover:bg-white/20 dark:hover:bg-black/50 dark:border-white/10 last:border-b"
              data-sb-object-id={`posts/${post.filePath}`}
            >
              <Link
                as={`/posts/${post.filePath.replace(/\.mdx?$/, '')}`}
                href={`/posts/[slug]`}
                className="block px-6 py-6 lg:py-10 lg:px-16 focus:outline-hidden focus:ring-4 focus:ring-primary/50"
              >
                {post.data.date && (
                  <p
                    className="mb-3 font-bold uppercase opacity-60"
                    data-sb-field-path="date"
                  >
                    {post.data.date}
                  </p>
                )}
                <h2 className="text-2xl md:text-3xl" data-sb-field-path="title">
                  {post.data.title}
                </h2>
                {post.data.description && (
                  <p
                    className="mt-3 text-lg opacity-60"
                    data-sb-field-path="description"
                  >
                    {post.data.description}
                  </p>
                )}
                <ArrowIcon className="mt-4" />
              </Link>
            </li>
          ))}
        </ul>

        {/* Call to Action for Non-Authenticated Users */}
        {mounted && !isAuthenticated && (
          <div className="mt-12 p-8 bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg rounded-lg border border-gray-200/20 text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold mb-4">Share Your Blog with Lemmy</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              Connect your blog to the Lemmy ecosystem! Login with your Lemmy account 
              to cross-post your blog content to relevant communities and reach a wider audience.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors font-medium"
            >
              🔗 Connect with Lemmy
            </Link>
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
  const posts = getPosts();
  const globalData = getGlobalData();

  return { props: { posts, globalData } };
}
