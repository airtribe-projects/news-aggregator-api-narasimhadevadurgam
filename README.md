# News Aggregator API

A RESTful API for a personalized news aggregator built with Node.js and Express.js. Users can register, log in, set their news preferences, and fetch news articles tailored to their interests.

## Tech Stack

- **Node.js** (>= 18) + **Express.js** — HTTP server and routing
- **bcryptjs** — password hashing
- **jsonwebtoken** — token-based authentication
- **axios** — external news API requests
- **In-memory store** — user data and news cache (no database required)

## Getting Started

```bash
# Install dependencies
npm install

# Start the server
node app.js

# Run tests
npm run test
```

The server runs on `http://localhost:3000` by default.

### Environment Variables (optional)

| Variable         | Description                        |
| ---------------- | ---------------------------------- |
| `GNEWS_API_KEY`  | API key for GNews (gnews.io)       |

If no API key is set, the `/news` endpoint returns placeholder articles based on user preferences.

## API Endpoints

### Authentication

| Method | Endpoint          | Body                                          | Description          |
| ------ | ----------------- | --------------------------------------------- | -------------------- |
| POST   | `/users/signup`   | `{ name, email, password, preferences? }`     | Register a new user  |
| POST   | `/users/login`    | `{ email, password }`                         | Log in, returns JWT  |

### Preferences (requires `Authorization: Bearer <token>`)

| Method | Endpoint              | Body                     | Description              |
| ------ | --------------------- | ------------------------ | ------------------------ |
| GET    | `/users/preferences`  | —                        | Get user preferences     |
| PUT    | `/users/preferences`  | `{ preferences: [] }`   | Update user preferences  |

### News (requires `Authorization: Bearer <token>`)

| Method | Endpoint | Description                                      |
| ------ | -------- | ------------------------------------------------ |
| GET    | `/news`  | Fetch news articles based on user preferences    |

## Features

- **JWT Authentication** — secure token-based auth with 1-hour expiry
- **Password Hashing** — bcrypt with salt rounds for secure storage
- **Input Validation** — required fields checked on all endpoints
- **News Caching** — 5-minute TTL cache to reduce external API calls
- **Graceful Fallback** — placeholder articles returned when external API is unavailable
- **Error Handling** — consistent error responses across all endpoints

## Test Results

```
15 pass, 0 fail — 1 suite complete
```
