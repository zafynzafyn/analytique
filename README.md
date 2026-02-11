# Analytique

An AI-powered analytics dashboard that lets you query your Supabase database using natural language. Ask questions in plain English and get SQL queries, data visualizations, and insights automatically.

## Features

- **Natural Language Queries** - Ask questions like "What were our top 10 products last month?" and get SQL generated automatically
- **Data Visualization** - Results are displayed in charts (line, bar, pie, scatter) or tables based on the data
- **Key Insights** - AI extracts and highlights the most important findings from your data
- **Table Permissions** - Control which tables the AI can access for security
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

3. Copy the environment file and add your keys:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key
   ANTHROPIC_API_KEY=your-api-key
   ```

5. Run the Supabase setup script to create required tables:
   ```bash
   # Run the SQL in supabase-setup.sql in your Supabase SQL editor
   ```

6. Start the development server:
   ```bash
   pnpm dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

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
