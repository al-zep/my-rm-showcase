import { useState, useEffect, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Target, HandHeart } from "lucide-react";
import SlideCard from "@/components/dashboard/SlideCard";

interface OverviewCardProps {
  churchGoal: number;
  churchCollected: number;
  bestGroup?: { name: string; percentage?: number; total?: number } | null;
  myRemainingGoal: number;
  currency?: string;
  interval?: number;
  totalPledges?: number;
}

const OverviewCard = ({
  churchGoal,
  churchCollected,
  bestGroup = null,
  myRemainingGoal,
  currency = "TZS",
  interval = 7000,
  totalPledges,
}: OverviewCardProps) => {
  const bgImages = ['/home.1.jpg', '/home.2.jpg', '/home.3.jpg'];

  const slides: { id: string; content: ReactNode; bg?: string }[] = [
    {
      id: "church",
      bg: bgImages[0],
      content: (
        <>
          {/* header from ChurchSummaryCard */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white font-bold text-lg sm:text-xl">Church Annual Goal</p>
              <h2 className="text-white font-bold text-4xl sm:text-5xl mt-1">
                {currency} {churchGoal.toLocaleString()}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          {/* progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm">Progress</span>
              <span className="text-amber-400 font-bold">
                {(churchGoal > 0 ? ((churchCollected / churchGoal) * 100).toFixed(1) : 0)}%
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(
                  churchGoal > 0 ? (churchCollected / churchGoal) * 100 : 0,
                  100
                )}%` }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                style={{ boxShadow: "0 0 12px rgba(251, 191, 36, 0.5)" }}
              />
            </div>
          </div>
        </>
      ),
    },
    {
      id: "bestGroup",
      bg: bgImages[1],
      content: (
        <>
          <div className="mb-4">
            <p className="text-white font-bold text-lg sm:text-xl">Best Performing Group</p>
            <h2 className="text-white font-bold text-4xl sm:text-5xl mt-1">
              {bestGroup?.name ?? "N/A"}
            </h2>
          </div>
          <p className="text-amber-400 font-bold text-2xl sm:text-3xl">
            {bestGroup && bestGroup.percentage != null ? `${bestGroup.percentage}%` : ""}
          </p>
        </>
      ),
    },
    {
      id: "remaining",
      bg: bgImages[2],
      content: (
        <>
          <p className="text-white font-bold text-lg sm:text-xl">My Remaining Goal</p>
          <h2 className="text-white font-bold text-4xl sm:text-5xl mt-1">
            {currency} {myRemainingGoal.toLocaleString()}
          </h2>
        </>
      ),
    },
  ];

  if (typeof totalPledges === "number") {
    slides.push({
      id: "totalPledges",
      bg: bgImages[0],
      content: (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-bold text-lg sm:text-xl">Total Pledges (All Members)</p>
              <h2 className="text-white font-bold text-4xl sm:text-5xl mt-1">
                {currency} {totalPledges.toLocaleString()}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <HandHeart className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </>
      ),
    });
  }

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, interval ?? 7000); // default 7 seconds if not provided
    return () => clearInterval(timer);
  }, [slides.length, interval]);

  return (
    <SlideCard bgImage={slides[current].bg}>
      <AnimatePresence mode="wait">
        <motion.div
          key={slides[current].id}
          initial={{ opacity: 0, y: 10, scale: 1 }}
          animate={{ opacity: 1, y: 0, scale: 1.02 }}
          exit={{ opacity: 0, y: -10, scale: 1 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="relative z-10"
        >
          {slides[current].content}
        </motion.div>
      </AnimatePresence>
    </SlideCard>
  );
};

export default OverviewCard;
