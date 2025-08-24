import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedToken = localStorage.getItem('lemmy-blog-token');
    const storedUser = localStorage.getItem('lemmy-blog-user');
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem('lemmy-blog-token');
        localStorage.removeItem('lemmy-blog-user');
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
        localStorage.setItem('lemmy-blog-token', data.token);
        localStorage.setItem('lemmy-blog-user', JSON.stringify(data.user));
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('lemmy-blog-token');
    localStorage.removeItem('lemmy-blog-user');
  };

  const postToLemmy = async (postData) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/.netlify/functions/lemmy-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(postData),
    });

    return await response.json();
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
