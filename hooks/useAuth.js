import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Safe localStorage wrapper
const safeLocalStorage = {
  getItem: (key) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session only after component mounts
    const storedToken = safeLocalStorage.getItem('lemmy-blog-token');
    const storedUser = safeLocalStorage.getItem('lemmy-blog-user');
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        safeLocalStorage.removeItem('lemmy-blog-token');
        safeLocalStorage.removeItem('lemmy-blog-user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (instance, username, password) => {
    try {
      const response = await fetch('/.netlify/functions/lemmy-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance, username, password }),
      });

      const data = await response.json();
      
      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        safeLocalStorage.setItem('lemmy-blog-token', data.token);
        safeLocalStorage.setItem('lemmy-blog-user', JSON.stringify(data.user));
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    safeLocalStorage.removeItem('lemmy-blog-token');
    safeLocalStorage.removeItem('lemmy-blog-user');
  };

  const postToLemmy = async (postData) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('/.netlify/functions/lemmy-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Post to Lemmy error:', error);
      throw error;
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    postToLemmy,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
