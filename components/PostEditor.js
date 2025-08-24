import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function PostEditor({ post, onSave, onCancel }) {
  const { postToLemmy } = useAuth();
  const [formData, setFormData] = useState({
    title: post.title || '',
    content: post.content || '',
    community: post.community || '',
    url: post.url || ''
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
      const result = await postToLemmy(formData);
      
      if (result.success) {
        setSuccess(`Posted successfully! View at: ${result.postUrl}`);
        // Clear form after successful post
        setTimeout(() => {
          onSave(formData);
        }, 2000);
      } else {
        setError(result.error || 'Failed to post to Lemmy');
      }
    } catch (error) {
      setError('Error posting to Lemmy: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">
        {post.isNew ? 'New Post to Lemmy' : 'Edit Post'}
      </h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
            placeholder="Your post title"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Community *</label>
          <input
            type="text"
            placeholder="programming@lemmy.ml"
            value={formData.community}
            onChange={(e) => setFormData({...formData, community: e.target.value})}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Format: communityname@instance.com</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">URL (optional)</label>
          <input
            type="url"
            placeholder="https://yourblog.com/post-title"
            value={formData.url}
            onChange={(e) => setFormData({...formData, url: e.target.value})}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">Link to your blog post or external content</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Content *</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            rows="12"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
            placeholder="Write your post content here... (Markdown supported)"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/80 disabled:opacity-50"
          >
            {loading ? 'Posting to Lemmy...' : 'Post to Lemmy'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
