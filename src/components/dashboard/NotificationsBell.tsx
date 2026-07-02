import { useEffect, useRef, useState } from "react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/database";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const NotificationsBell = ({ userId }: { userId: string | undefined }) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async (): Promise<NotificationRow[]> => {
      if (!userId) return [];
      const { data, error } = await getSupabaseClient()
        .from("notifications")
        .select("id,title,message,read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("Failed to load notifications:", error.message);
        return [];
      }
      return (data ?? []) as NotificationRow[];
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markOne = async (id: string) => {
    await getSupabaseClient().from("notifications").update({ read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  const markAll = async () => {
    if (!userId) return;
    await getSupabaseClient()
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center relative transition-all duration-300 backdrop-blur-sm border border-white/20"
        title="Notifications"
      >
        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-white/40">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-3 w-[92vw] sm:w-96 max-h-[70vh] rounded-2xl shadow-2xl overflow-hidden z-50 border border-white/15"
            style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 55%, #1a3a5c 100%)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-300" />
                <span className="text-white font-semibold text-sm">Notifications</span>
                {unread > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-200 border border-red-400/30">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={markAll}
                    className="text-[11px] text-amber-300 hover:text-amber-200 px-2 py-1 rounded-md hover:bg-white/5 flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
              {notifications.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <Bell className="w-10 h-10 mx-auto text-white/30 mb-2" />
                  <p className="text-white/70 text-sm">You're all caught up</p>
                  <p className="text-white/40 text-xs mt-1">New messages appear here every Friday.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 flex gap-3 items-start hover:bg-white/[0.04] transition-colors ${
                        !n.read ? "bg-white/[0.03]" : ""
                      }`}
                    >
                      <div className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.read ? "transparent" : "#f5c451" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white text-sm font-semibold truncate">{n.title}</p>
                          <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-white/75 text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                          {n.message}
                        </p>
                        {!n.read && (
                          <button
                            onClick={() => markOne(n.id)}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
                          >
                            <Check className="w-3 h-3" /> Mark as read
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationsBell;
