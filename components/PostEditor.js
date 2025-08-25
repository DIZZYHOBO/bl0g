import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';

// Markdown toolbar button component
function ToolbarButton({ icon, title, onClick, shortcut }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${title} (${shortcut})` : title}
      className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
    >
      <span className="text-lg">{icon}</span>
    </button>
  );
}

// Divider component
function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />;
}

export default function PostEditor({ post, onSave, onCancel }) {
  const { createPost, user } = useAuth();
  const router = useRouter();
  const textareaRef = useRef(null);
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

  // Helper function to insert text at cursor position
  const insertAtCursor = (before, after = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end) || placeholder;

    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    
    setFormData({ ...formData, content: newText });
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Markdown formatting functions
  const addBold = () => insertAtCursor('**', '**', 'bold text');
  const addItalic = () => insertAtCursor('*', '*', 'italic text');
  const addStrikethrough = () => insertAtCursor('~~', '~~', 'strikethrough');
  const addCode = () => insertAtCursor('`', '`', 'code');
  const addCodeBlock = () => insertAtCursor('```\n', '\n```', 'code block');
  const addLink = () => insertAtCursor('[', '](url)', 'link text');
  const addImage = () => insertAtCursor('![', '](url)', 'alt text');
  const addH1 = () => insertAtCursor('# ', '', 'Heading 1');
  const addH2 = () => insertAtCursor('## ', '', 'Heading 2');
  const addH3 = () => insertAtCursor('### ', '', 'Heading 3');
  const addQuote = () => insertAtCursor('> ', '', 'quote');
  const addBulletList = () => insertAtCursor('- ', '', 'list item');
  const addNumberedList = () => insertAtCursor('1. ', '', 'list item');
  const addHorizontalRule = () => insertAtCursor('\n---\n', '', '');
  const addTable = () => {
    const table = '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n';
    insertAtCursor(table, '', '');
  };

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
        
        const shouldReturnHome = router.query.returnHome === 'true' || 
                                 sessionStorage.getItem('postCreatedCallback') === 'true';
        
        if (!formData.isDraft && shouldReturnHome) {
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
          <label className="block text-sm font-medium mb-1">Content * (Markdown Supported)</label>
          
          {/* Markdown Toolbar */}
          <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-t-lg p-2 flex flex-wrap items-center gap-1">
            {/* Text Formatting */}
            <div className="flex items-center">
              <ToolbarButton icon="B" title="Bold" onClick={addBold} shortcut="Ctrl+B" />
              <ToolbarButton icon="I" title="Italic" onClick={addItalic} shortcut="Ctrl+I" />
              <ToolbarButton icon="S̶" title="Strikethrough" onClick={addStrikethrough} />
              <ToolbarButton icon="<>" title="Inline Code" onClick={addCode} />
            </div>
            
            <ToolbarDivider />
            
            {/* Headings */}
            <div className="flex items-center">
              <ToolbarButton icon="H1" title="Heading 1" onClick={addH1} />
              <ToolbarButton icon="H2" title="Heading 2" onClick={addH2} />
              <ToolbarButton icon="H3" title="Heading 3" onClick={addH3} />
            </div>
            
            <ToolbarDivider />
            
            {/* Lists and Quotes */}
            <div className="flex items-center">
              <ToolbarButton icon="•" title="Bullet List" onClick={addBulletList} />
              <ToolbarButton icon="1." title="Numbered List" onClick={addNumberedList} />
              <ToolbarButton icon="❝" title="Quote" onClick={addQuote} />
            </div>
            
            <ToolbarDivider />
            
            {/* Links and Media */}
            <div className="flex items-center">
              <ToolbarButton icon="🔗" title="Add Link" onClick={addLink} />
              <ToolbarButton icon="🖼️" title="Add Image" onClick={addImage} />
            </div>
            
            <ToolbarDivider />
            
            {/* Advanced */}
            <div className="flex items-center">
              <ToolbarButton icon="[/]" title="Code Block" onClick={addCodeBlock} />
              <ToolbarButton icon="⊞" title="Table" onClick={addTable} />
              <ToolbarButton icon="―" title="Horizontal Rule" onClick={addHorizontalRule} />
            </div>
          </div>
          
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            rows="15"
            className="w-full p-3 border border-t-0 rounded-b-lg dark:bg-gray-700 dark:border-gray-600 bg-white/50 font-mono text-sm"
            required
            placeholder="Write your blog post content here... (Markdown supported)"
            disabled={loading}
          />
          
          {/* Markdown Help */}
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Markdown Quick Reference
            </summary>
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs space-y-1 font-mono">
              <div><strong>Bold:</strong> **text** or __text__</div>
              <div><strong>Italic:</strong> *text* or _text_</div>
              <div><strong>Link:</strong> [text](url)</div>
              <div><strong>Image:</strong> ![alt text](url)</div>
              <div><strong>Code:</strong> `code` or ```language\ncode block\n```</div>
              <div><strong>Headers:</strong> # H1, ## H2, ### H3</div>
              <div><strong>Lists:</strong> - item or 1. item</div>
              <div><strong>Quote:</strong> > quoted text</div>
              <div><strong>Table:</strong> | Col1 | Col2 |</div>
            </div>
          </details>
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
