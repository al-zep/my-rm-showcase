import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useState } from "react";
import { getSession } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/useAdmin";
import AdminPanel from "@/components/admin/AdminPanel";

const Header = () => {
  const location = useLocation();
  const session = getSession();
  const { data: isAdmin = false } = useIsAdmin(session?.user_id);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <motion.header
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200"
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-lg text-church-blue">Chuo Kikuu SDA Church</span>
        </Link>

        <nav className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setAdminOpen(true)}
              aria-label="Admin settings"
              title="Admin Panel"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-church-blue bg-amber-100 hover:bg-amber-200 transition-colors border border-amber-300"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </nav>
      </div>
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}
    </motion.header>
  );
};

export default Header;
