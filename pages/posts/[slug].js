import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { MDXRemote } from 'next-mdx-remote';
import { serialize } from 'next-mdx-remote/serialize';
import Head from 'next/head';
import Link from 'next/link';
import ArrowIcon from '../../components/ArrowIcon';
import CustomImage from '../../components/CustomImage';
import CustomLink from '../../components/CustomLink';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import Layout, { GradientBackground } from '../../components/Layout';
import SEO from '../../components/SEO';
import { getGlobalData } from '../../utils/global-data';

// Custom components for MDX
const components = {
  a: CustomLink,
  Head,
  img: CustomImage,
};

export default function PostPage({ globalData }) {
  const router = useRouter();
  const { slug } = router.query;
  const [post, setPost] = useState(null);
  const [mdxSource, setMdxSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;

    const fetchPost = async () => {
      try {
        setLoading(true);
        
        // Try to fetch from API first
        const response = await fetch(`/.netlify/functions/api-posts-slug-db/${slug}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const postData = data.data.post;
            setPost(postData);
            
            // Serialize MDX content
            const mdx = await serialize(postData.content || '# Post Content\n\nContent not available.');
            setMdxSource(mdx);
          } else {
            setError('Post not found');
          }
        } else {
          setError('Post not found');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <Layout>
        <Header name={globalData.name} />
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div>Loading post...</div>
        </div>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <SEO title={`Post Not Found - ${globalData.name}`} description="The requested post could not be found" />
        <Header name={globalData.name} />
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📄</div>
          <h1 className="text-3xl font-bold mb-4">Post Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The post you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link 
            href="/"
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO
        title={`${post.title} - ${globalData.name}`}
        description={post.description}
      />
      <Header name={globalData.name} />
      
      <article className="px-6 md:px-0 max-w-4xl mx-auto">
        <header className="mb-8">
          {/* Back to Home Link */}
          <Link 
            href="/"
            className="inline-flex items-center text-primary hover:text-primary/80 mb-6 transition-colors"
          >
            <ArrowIcon className="rotate-180 mr-2 w-4 h-4" />
            Back to Community Posts
          </Link>

          {/* Post Meta */}
          <div className="mb-6">
            {post.date && (
              <p className="text-sm font-bold uppercase opacity-60 mb-2">
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
            {post.author && (
              <p className="text-primary font-medium mb-4">
                By {post.author}
              </p>
            )}
            {post.tags && post.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {post.tags.map((tag, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1 text-sm bg-primary/20 text-primary rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-bold mb-6 dark:text-white">
            {post.title}
          </h1>
          
          {/* Description */}
          {post.description && (
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              {post.description}
            </p>
          )}

          {/* Read Time */}
          {post.read_time && (
            <p className="text-sm opacity-60 mb-8">
              {post.read_time} min read
            </p>
          )}
        </header>

        {/* Post Content */}
        <main>
          <article className="prose prose-lg dark:prose-invert max-w-none">
            {mdxSource ? (
              <MDXRemote {...mdxSource} components={components} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Content not available</p>
              </div>
            )}
          </article>
        </main>

        {/* Back to Home Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
          <Link 
            href="/"
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            ← Back to Community Posts
          </Link>
        </footer>
      </article>

      <Footer copyrightText={globalData.footerText} />
      <GradientBackground
        variant="large"
        className="absolute -top-32 opacity-30 dark:opacity-50"
      />
      <GradientBackground
        variant="small"
        className="absolute bottom-0 opacity-20 dark:opacity-10"
      />
    </Layout>
  );
}

// Use getServerSideProps for dynamic content
export async function getServerSideProps(context) {
  const globalData = getGlobalData();
  
  return {
    props: {
      globalData,
    },
  };
}
