# Sleeper League Analytics

A React application built with Vite and Tailwind CSS for analyzing Sleeper fantasy football leagues.

## 🚀 Tech Stack

- **React** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **ESLint** - Code linting

## 📁 Project Structure

```
sleeper-league-analytics/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images, fonts, icons
│   ├── components/     # Reusable UI components (Button, Card, Modal, etc.)
│   ├── context/        # React Context providers (AuthContext, ThemeContext, etc.)
│   ├── hooks/          # Custom React hooks (useAuth, useFetch, etc.)
│   ├── layouts/        # Layout components (MainLayout, Sidebar, Header, etc.)
│   ├── pages/          # Page components/routes (HomePage, Dashboard, etc.)
│   ├── utils/          # Helper functions and utilities
│   ├── App.jsx         # Main App component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles with Tailwind directives
├── index.html          # HTML template
├── tailwind.config.js  # Tailwind configuration
├── postcss.config.js   # PostCSS configuration
├── vite.config.js      # Vite configuration
└── package.json        # Dependencies and scripts
```

## 🛠️ Getting Started

### Prerequisites

> ⚠️ **Note**: This project requires Node.js 20.19+ or 22.12+. Your current version is v18.14.2. Please upgrade Node.js to run the dev server.

### Installation

Dependencies are already installed. To reinstall:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

> **Note**: You'll need to upgrade Node.js first for the dev server to work.

### Build

Build for production:

```bash
npm run build
```

### Preview

Preview the production build:

```bash
npm run preview
```

## 📝 Development Guidelines

### Components
- Place reusable UI components in `src/components/`
- Use Tailwind CSS for styling
- Keep components small and focused on a single responsibility

### Hooks
- Custom hooks should start with `use` prefix (e.g., `useAuth`, `useFetch`)
- Place them in `src/hooks/`

### Context
- Use Context API for global state management
- Create separate contexts for different concerns (auth, theme, etc.)
- Place them in `src/context/`

### Pages
- Each route should have its own page component in `src/pages/`
- Pages should compose smaller components

### Utils
- Place utility functions and helpers in `src/utils/`
- Keep functions pure and testable

### Layouts
- Create reusable layout components (headers, sidebars, footers) in `src/layouts/`
- Use layouts to wrap pages with common structure

## 🎨 Styling with Tailwind

Tailwind CSS is configured and ready to use. Simply add utility classes to your components:

```jsx
<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
  Click me
</button>
```

## 📦 Next Steps

1. **Upgrade Node.js** to version 20.19+ or 22.12+
2. Start building your components in `src/components/`
3. Create pages in `src/pages/`
4. Add routing (consider installing `react-router-dom`)
5. Set up API integration for Sleeper data
6. Build your analytics features!

## 🔧 Troubleshooting

### Dev server won't start
- Make sure you're using Node.js 20.19+ or 22.12+
- Run `npm install` to ensure all dependencies are installed

### Tailwind classes not working
- Ensure files are listed in `tailwind.config.js` content array
- Check that `@tailwind` directives are in `src/index.css`

## 📄 License

MIT
