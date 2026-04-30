const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const port = 3000;
const JWT_SECRET = 'news-aggregator-secret-key';

// In-memory user store
const users = [];

// Simple in-memory news cache: { key: { data, timestamp } }
const newsCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Auth Middleware ----

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ---- Auth Routes ----

// POST /users/signup
app.post('/users/signup', async (req, res) => {
  try {
    const { name, email, password, preferences } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: users.length + 1,
      name,
      email,
      password: hashedPassword,
      preferences: preferences || [],
    };

    users.push(user);

    return res.status(200).json({
      message: 'User registered successfully.',
      user: { id: user.id, name: user.name, email: user.email, preferences: user.preferences },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /users/login
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- Preferences Routes ----

// GET /users/preferences
app.get('/users/preferences', authenticate, (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.status(200).json({ preferences: user.preferences });
});

// PUT /users/preferences
app.put('/users/preferences', authenticate, (req, res) => {
  const { preferences } = req.body;

  if (!preferences || !Array.isArray(preferences)) {
    return res.status(400).json({ error: 'Preferences must be an array.' });
  }

  const user = users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  user.preferences = preferences;
  return res.status(200).json({ message: 'Preferences updated.', preferences: user.preferences });
});

// ---- News Route ----

// GET /news
app.get('/news', authenticate, async (req, res) => {
  try {
    const user = users.find((u) => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const preferences = user.preferences;
    if (!preferences || preferences.length === 0) {
      return res.status(200).json({ news: [] });
    }

    const cacheKey = preferences.sort().join(',');

    // Check cache
    if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].timestamp < CACHE_TTL) {
      return res.status(200).json({ news: newsCache[cacheKey].data });
    }

    let articles = [];
    const query = preferences.join(' OR ');

    // Try NewsAPI first, then GNews, then fallback to placeholders
    try {
      const newsApiKey = process.env.NEWS_API_KEY || '';
      if (newsApiKey) {
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: { q: query, pageSize: 10, language: 'en', sortBy: 'publishedAt' },
          headers: { 'X-Api-Key': newsApiKey },
          timeout: 5000,
        });
        if (response.data && response.data.articles && response.data.articles.length > 0) {
          articles = response.data.articles.map((a) => ({
            title: a.title,
            description: a.description,
            url: a.url,
            source: a.source?.name || 'Unknown',
            publishedAt: a.publishedAt,
          }));
        }
      }
    } catch (newsApiErr) {
      // NewsAPI failed, will try GNews next
    }

    // Fallback to GNews if NewsAPI returned nothing
    if (articles.length === 0) {
      try {
        const gnewsKey = process.env.GNEWS_API_KEY || '';
        if (gnewsKey) {
          const response = await axios.get('https://gnews.io/api/v4/search', {
            params: { q: query, lang: 'en', max: 10, apikey: gnewsKey },
            timeout: 5000,
          });
          if (response.data && response.data.articles && response.data.articles.length > 0) {
            articles = response.data.articles.map((a) => ({
              title: a.title,
              description: a.description,
              url: a.url,
              source: a.source?.name || 'Unknown',
              publishedAt: a.publishedAt,
            }));
          }
        }
      } catch (gnewsErr) {
        // GNews also failed, will use placeholders
      }
    }

    // Final fallback: placeholder articles
    if (articles.length === 0) {
      articles = preferences.map((pref) => ({
        title: `Latest ${pref} news`,
        description: `Top stories about ${pref}`,
        url: `https://example.com/news/${pref}`,
        source: 'News Aggregator',
        publishedAt: new Date().toISOString(),
      }));
    }

    // Update cache
    newsCache[cacheKey] = { data: articles, timestamp: Date.now() };

    return res.status(200).json({ news: articles });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch news.' });
  }
});

// Start server only when not in test
if (require.main === module) {
  app.listen(port, (err) => {
    if (err) {
      return console.log('Something bad happened', err);
    }
    console.log(`Server is listening on ${port}`);
  });
}

module.exports = app;
