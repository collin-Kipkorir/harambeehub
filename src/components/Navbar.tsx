import { Link, useLocation } from 'react-router-dom';
import { Heart, Home, PlusCircle, Search } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/feed', icon: Search, label: 'Explore' },
  { path: '/create', icon: PlusCircle, label: 'Create' },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Heart className="w-4 h-4 text-primary-foreground" fill="currentColor" />
            </div>
            <span className="font-bold text-lg text-foreground">HarambeeHub</span>
          </Link>
          <Link to="/create">
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl"
            >
              Start Fundraiser
            </motion.div>
          </Link>
        </div>
      </header>

      {/* Bottom nav - mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t md:hidden">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link key={path} to={path} className="flex flex-col items-center gap-0.5 min-w-[60px]">
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`p-2 rounded-2xl transition-colors ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
