import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Users, BarChart3, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/database";
import ChurchSettingsForm from "@/components/dashboard/ChurchSettingsForm";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Tab = "settings" | "users" | "analytics";
type Range = "week" | "month" | "quarter";

interface UserRow {
  full_name: string;
  phone: string;
  pledge: number;
  contribution: number;
}

const useAdminUserData = () => {
  return useQuery({
    queryKey: ["admin-user-export"],
    queryFn: async (): Promise<UserRow[]> => {
      const client = getSupabaseClient();
      const year = new Date().getFullYear();
      const [profilesRes, pledgesRes, contribsRes] = await Promise.all([
        client.from("profiles").select("id, full_name, phone"),
        client.from("pledges").select("user_id, pledge_amount, year").eq("year", year),
        client.from("contributions").select("user_id, amount, status").eq("status", "completed"),
      ]);
      const profiles = profilesRes.data ?? [];
      const pledges = pledgesRes.data ?? [];
      const contribs = contribsRes.data ?? [];
      const pledgeMap = new Map<string, number>();
      pledges.forEach((p: any) => {
        pledgeMap.set(p.user_id, Number(p.pledge_amount || 0));
      });
      const contribMap = new Map<string, number>();
      contribs.forEach((c: any) => {
        contribMap.set(c.user_id, (contribMap.get(c.user_id) || 0) + Number(c.amount || 0));
      });
      return profiles.map((p: any) => ({
        full_name: p.full_name || "—",
        phone: p.phone || "—",
        pledge: pledgeMap.get(p.id) || 0,
        contribution: contribMap.get(p.id) || 0,
      }));
    },
    staleTime: 30_000,
  });
};

const useAdminContributionSeries = () => {
  return useQuery({
    queryKey: ["admin-contributions-series"],
    queryFn: async () => {
      const client = getSupabaseClient();
      const { data } = await client
        .from("contributions")
        .select("amount, created_at, status")
        .eq("status", "completed");
      return (data ?? []).map((c: any) => ({
        amount: Number(c.amount || 0),
        date: new Date(c.created_at),
      }));
    },
    staleTime: 30_000,
  });
};

const aggregate = (
  items: { amount: number; date: Date }[],
  range: Range
) => {
  const now = new Date();
  const buckets = new Map<string, number>();
  const order: string[] = [];

  const pushBucket = (key: string) => {
    if (!buckets.has(key)) {
      buckets.set(key, 0);
      order.push(key);
    }
  };

  if (range === "week") {
    // last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString("en-US", { weekday: "short" });
      pushBucket(key);
    }
    items.forEach(({ amount, date }) => {
      const diff = (now.getTime() - date.getTime()) / 86400000;
      if (diff <= 7 && diff >= 0) {
        const key = date.toLocaleDateString("en-US", { weekday: "short" });
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + amount);
      }
    });
  } else if (range === "month") {
    // last 4 weeks
    for (let i = 3; i >= 0; i--) pushBucket(`Wk ${4 - i}`);
    items.forEach(({ amount, date }) => {
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
      if (diffDays < 28 && diffDays >= 0) {
        const wk = 4 - Math.floor(diffDays / 7);
        const key = `Wk ${wk}`;
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + amount);
      }
    });
  } else {
    // quarter: last 3 months
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-US", { month: "short" });
      pushBucket(key);
    }
    items.forEach(({ amount, date }) => {
      const monthsDiff =
        (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
      if (monthsDiff >= 0 && monthsDiff < 3) {
        const key = date.toLocaleDateString("en-US", { month: "short" });
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + amount);
      }
    });
  }

  return order.map((k) => ({ label: k, amount: buckets.get(k) || 0 }));
};

const exportPDF = (rows: UserRow[]) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Chuo Kikuu SDA Church — Members Report", 14, 18);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  autoTable(doc, {
    startY: 30,
    head: [["Full Name", "Phone", "Pledge (TZS)", "Contribution (TZS)"]],
    body: rows.map((r) => [
      r.full_name,
      r.phone,
      r.pledge.toLocaleString(),
      r.contribution.toLocaleString(),
    ]),
    foot: [[
      "Total",
      "",
      rows.reduce((s, r) => s + r.pledge, 0).toLocaleString(),
      rows.reduce((s, r) => s + r.contribution, 0).toLocaleString(),
    ]],
    headStyles: { fillColor: [30, 58, 95] },
    footStyles: { fillColor: [212, 160, 23], textColor: 20, fontStyle: "bold" },
  });
  doc.save(`members-report-${new Date().toISOString().slice(0, 10)}.pdf`);
};

const exportExcel = (rows: UserRow[]) => {
  const wsData = [
    ["Full Name", "Phone", "Pledge (TZS)", "Contribution (TZS)"],
    ...rows.map((r) => [r.full_name, r.phone, r.pledge, r.contribution]),
    [
      "Total",
      "",
      rows.reduce((s, r) => s + r.pledge, 0),
      rows.reduce((s, r) => s + r.contribution, 0),
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Members");
  XLSX.writeFile(wb, `members-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const AdminPanel = ({ open, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>("settings");
  const [range, setRange] = useState<Range>("week");
  const usersQuery = useAdminUserData();
  const seriesQuery = useAdminContributionSeries();

  const chartData = useMemo(
    () => (seriesQuery.data ? aggregate(seriesQuery.data, range) : []),
    [seriesQuery.data, range]
  );

  const totalForRange = chartData.reduce((s, d) => s + d.amount, 0);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "settings", label: "Church Settings", icon: Settings },
    { id: "users", label: "Export Users", icon: Users },
    { id: "analytics", label: "Contribution Trends", icon: BarChart3 },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
            style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a3a5c 100%)" }}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Settings className="w-5 h-5" />
                <h2 className="font-semibold text-lg">Admin Panel</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 px-3 pt-3 overflow-x-auto">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5 overflow-y-auto">
              {tab === "settings" && <ChurchSettingsForm />}

              {tab === "users" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-white">
                      <p className="font-semibold">All Members</p>
                      <p className="text-xs text-white/60">
                        Auto-updates with new pledges & contributions
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => usersQuery.data && exportPDF(usersQuery.data)}
                        disabled={!usersQuery.data?.length}
                        className="bg-rose-500/20 hover:bg-rose-500/30 text-white border border-rose-400/40"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        PDF
                      </Button>
                      <Button
                        onClick={() => usersQuery.data && exportExcel(usersQuery.data)}
                        disabled={!usersQuery.data?.length}
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-white border border-emerald-400/40"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 overflow-hidden">
                    {usersQuery.isLoading ? (
                      <div className="p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      </div>
                    ) : (
                      <div className="max-h-[50vh] overflow-y-auto">
                        <table className="w-full text-sm text-white">
                          <thead className="bg-white/10 sticky top-0">
                            <tr>
                              <th className="text-left p-2">Name</th>
                              <th className="text-left p-2">Phone</th>
                              <th className="text-right p-2">Pledge</th>
                              <th className="text-right p-2">Contribution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(usersQuery.data ?? []).map((r, i) => (
                              <tr key={i} className="border-t border-white/5">
                                <td className="p-2">{r.full_name}</td>
                                <td className="p-2">{r.phone}</td>
                                <td className="p-2 text-right">
                                  {r.pledge.toLocaleString()}
                                </td>
                                <td className="p-2 text-right">
                                  {r.contribution.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                            {!usersQuery.data?.length && (
                              <tr>
                                <td colSpan={4} className="p-6 text-center text-white/60">
                                  No members yet
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "analytics" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="text-white">
                      <p className="font-semibold">Church Contribution Trends</p>
                      <p className="text-xs text-white/60">
                        Aggregate totals only — no individual data shown
                      </p>
                    </div>
                    <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                      {(["week", "month", "quarter"] as Range[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRange(r)}
                          className={`px-3 py-1.5 text-xs rounded-md capitalize transition-colors ${
                            range === r
                              ? "bg-amber-400 text-slate-900 font-semibold"
                              : "text-white/70 hover:text-white"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60 mb-1">Total for selected range</p>
                    <p className="text-2xl font-bold text-amber-300">
                      TZS {totalForRange.toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 h-72">
                    {seriesQuery.isLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="label" stroke="rgba(255,255,255,0.6)" fontSize={12} />
                          <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              background: "#0f2744",
                              border: "1px solid rgba(255,255,255,0.2)",
                              borderRadius: 8,
                              color: "white",
                            }}
                            formatter={(v: any) => [`TZS ${Number(v).toLocaleString()}`, "Amount"]}
                          />
                          <Bar dataKey="amount" fill="#f5b800" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdminPanel;
