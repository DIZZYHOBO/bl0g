import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function PostEditor({ post, onSave, onCancel }) {
  const { createPost, user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: post?.title || '',
    content: post?.content || '',
    description: post?.description || '',
    tags: post?.tags || '',
    isDraft: post?.isDraft || false
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const postData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      };

      const result = await createPost(postData);
      
      if (result.success) {
        const successMessage = `Post ${formData.isDraft ? 'saved as draft' : 'published'} successfully!`;
        setSuccess(successMessage);
        
        // Check if we should return to home page
        const shouldReturnHome = router.query.returnHome === 'true' || 
                                 sessionStorage.getItem('postCreatedCallback') === 'true';
        
        if (!formData.isDraft && shouldReturnHome) {
          // Clear callback flag
          sessionStorage.removeItem('postCreatedCallback');
          
          setTimeout(() => {
            router.push('/?newPost=success');
          }, 1500);
        } else {
          setTimeout(() => {
            onSave(formData);
          }, 2000);
        }
      } else {
        setError(result.error || 'Failed to create post');
      }
    } catch (error) {
      setError('Error creating post: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg p-6 rounded-lg shadow-md border border-gray-200/20">
      <h3 className="text-xl font-semibold mb-4">
        {post?.isNew ? 'Create New Blog Post' : 'Edit Blog Post'}
      </h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
          {success}
          {router.query.returnHome === 'true' && !formData.isDraft && (
            <div className="mt-2 text-sm">Redirecting to home page...</div>
          )}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white/50"
            required
            placeholder="Your blog post title"
            disabled={loading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white/50"
            placeholder="Brief description of your post"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({...formData, tags: e.target.value})}
            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white/50"
            placeholder="javascript, web development, tutorial (comma-separated)"
            disabled={loading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Content *</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            rows="15"
            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white/50"
            required
            placeholder="Write your blog post content here... (Markdown supported)"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            You can use Markdown formatting. The post will be saved as an MDX file.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isDraft"
            checked={formData.isDraft}
            onChange={(e) => setFormData({...formData, isDraft: e.target.checked})}
            className="rounded"
            disabled={loading}
          />
          <label htmlFor="isDraft" className="text-sm">
            Save as draft (will not be published)
          </label>
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm">
          <p className="font-medium mb-1">
            Author: {user?.display_name || user?.username}@{user?.instance}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            This post will be saved to your blog repository and {formData.isDraft ? 'saved as a draft' : 'published live'}.
            {router.query.returnHome === 'true' && !formData.isDraft && (
              <span className="block mt-1 text-primary font-medium">
                After publishing, you will be redirected to the home page.
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
          >
            {loading ? 'Saving...' : formData.isDraft ? 'Save Draft' : 'Publish Post'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-400 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          {router.query.returnHome === 'true' && (
            <Link
              href="/"
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-center"
            >
              Back to Home
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
