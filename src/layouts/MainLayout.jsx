import { Outlet, Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';

const MainLayout = () => {
    return (
        <div className="min-h-screen bg-bg text-text font-sans">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:rounded-md focus:bg-bg-1 focus:text-text focus:ring-1 focus:ring-signal"
            >
                Skip to content
            </a>
            <Navbar />
            <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
            <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-2 border-t border-line mt-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-2xs uppercase tracking-wider text-text-mute">
                    <span>Data from the Sleeper public API</span>
                    <Link to="/privacy" className="hover:text-signal transition-colors">
                        Privacy
                    </Link>
                </div>
            </footer>
        </div>
    );
};

export default MainLayout;
