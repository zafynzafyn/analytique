# Analytique

An AI-powered analytics dashboard that lets you query your Supabase database using natural language. Ask questions in plain English and get SQL queries, data visualizations, and insights automatically.

## Features

- **Natural Language Queries** - Ask questions like "What were our top 10 products last month?" and get SQL generated automatically
- **Data Visualization** - Results are displayed in charts (line, bar, pie, scatter) or tables based on the data
- **Key Insights** - AI extracts and highlights the most important findings from your data
- **In-App Database Configuration** - Configure your Supabase credentials directly in the app with connection testing
- **Table Security** - Role-based access control for tables and columns the AI can access
- **Chat History** - Save and revisit previous analysis sessions
- **Dark Mode** - Full light/dark theme support

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API
- **Monorepo**: Turborepo, pnpm

## Project Structure

```
analytique/
├── apps/
│   └── web/              # Next.js frontend application
├── packages/
│   ├── agent/            # AI analyst agent (Claude + SQL tools)
│   └── schemas/          # Schema annotations
```

## Pages

| Page | Description |
|------|-------------|
| `/` | Home page with quick links to chat and schema explorer |
| `/chat` | AI chat interface for natural language queries |
| `/schema` | Database schema explorer with table and column details |
| `/connection` | Supabase database connection settings |
| `/settings` | Table security and access control configuration |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account
- Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/zafynzafyn/analytique.git
   cd analytique
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy the environment file and add your Anthropic API key:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your-api-key
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

7. Navigate to **Connection** in the sidebar to configure your Supabase credentials:
   - Supabase URL
   - Anon/Public Key
   - Service Role Key

8. (Optional) Run the Supabase setup script to create required tables:
   ```bash
   # Run the SQL in supabase-setup.sql in your Supabase SQL editor
   ```

### Configuration Options

#### Environment Variables (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key for Claude |
| `SUPABASE_URL` | No* | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | No* | Your Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | No* | Your Supabase service role key |

*Supabase credentials can be configured via environment variables or through the in-app Connection settings page.

#### In-App Configuration

- **Connection Settings** (`/connection`) - Configure Supabase database credentials with a test connection feature
- **Table Security** (`/settings`) - Set access levels (Full, Read-Only, None) for each table and hide sensitive columns

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm clean` | Clean build artifacts |

## License

MIT
