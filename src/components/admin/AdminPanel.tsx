import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Users, BarChart3, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
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
type Category = "Members" | "Students" | "Regulars" | "Visitors";

interface UserRow {
  full_name: string;
  phone: string;
  pledge: number;
  contribution: number;
}

interface AdminExportData {
  sections: Record<Category, UserRow[]>;
  guestTotal: number;
  guestCount: number;
}

const CATEGORY_ORDER: Category[] = ["Members", "Students", "Regulars", "Visitors"];

const roleToCategory = (role: string | null | undefined): Category => {
  const r = (role || "").toLowerCase();
  if (r === "student") return "Students";
  if (r === "regular") return "Regulars";
  if (r === "visitor") return "Visitors";
  // member, church_member, admin, super_admin, user, etc.
  return "Members";
};

const useAdminUserData = () => {
  return useQuery({
    queryKey: ["admin-user-export"],
    queryFn: async (): Promise<AdminExportData> => {
      const client = getSupabaseClient();
      const year = new Date().getFullYear();
      const [profilesRes, pledgesRes, contribsRes] = await Promise.all([
        client.from("profiles").select("id, full_name, phone, role"),
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
      let guestTotal = 0;
      let guestCount = 0;
      contribs.forEach((c: any) => {
        if (!c.user_id) {
          guestTotal += Number(c.amount || 0);
          guestCount += 1;
        } else {
          contribMap.set(c.user_id, (contribMap.get(c.user_id) || 0) + Number(c.amount || 0));
        }
      });
      const sections: Record<Category, UserRow[]> = {
        Members: [], Students: [], Regulars: [], Visitors: [],
      };
      profiles.forEach((p: any) => {
        sections[roleToCategory(p.role)].push({
          full_name: p.full_name || "—",
          phone: p.phone || "—",
          pledge: pledgeMap.get(p.id) || 0,
          contribution: contribMap.get(p.id) || 0,
        });
      });
      return { sections, guestTotal, guestCount };
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

const buildSummary = (data: AdminExportData) => {
  return CATEGORY_ORDER.map((cat) => {
    const rows = data.sections[cat];
    const pledge = rows.reduce((s, r) => s + r.pledge, 0);
    const contribution = rows.reduce((s, r) => s + r.contribution, 0);
    return { cat, count: rows.length, pledge, contribution };
  });
};

const loadLogoDataUrl = async (): Promise<string | null> => {
  try {
    const res = await fetch("/sdaLogo.png");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const exportPDF = async (data: AdminExportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Hero section
  const logoDataUrl = await loadLogoDataUrl();
  let heroY = 15;
  if (logoDataUrl) {
    const logoSize = 26;
    doc.addImage(logoDataUrl, "PNG", centerX - logoSize / 2, heroY, logoSize, logoSize);
    heroY += logoSize + 6;
  } else {
    heroY += 8;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 95);
  doc.text("Seventh Day Adventist Church", centerX, heroY, { align: "center" });
  heroY += 6;

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text("Chuo Kikuu", centerX, heroY, { align: "center" });
  heroY += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text("Contributors Report", centerX, heroY, { align: "center" });
  heroY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, centerX, heroY, { align: "center" });
  heroY += 4;

  // divider
  doc.setDrawColor(212, 160, 23);
  doc.setLineWidth(0.6);
  doc.line(14, heroY + 2, pageWidth - 14, heroY + 2);
  doc.setTextColor(0, 0, 0);

  let cursorY = heroY + 10;

  CATEGORY_ORDER.forEach((cat) => {
    const rows = data.sections[cat];
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text(`${cat} (${rows.length})`, 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [["Full Name", "Phone", "Pledge (TZS)", "Contribution (TZS)"]],
      body: rows.length
        ? rows.map((r) => [
            r.full_name,
            r.phone,
            r.pledge.toLocaleString(),
            r.contribution.toLocaleString(),
          ])
        : [["—", "—", "—", "—"]],
      foot: [[
        "Subtotal",
        "",
        rows.reduce((s, r) => s + r.pledge, 0).toLocaleString(),
        rows.reduce((s, r) => s + r.contribution, 0).toLocaleString(),
      ]],
      headStyles: { fillColor: [30, 58, 95] },
      footStyles: { fillColor: [212, 160, 23], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
    if (cursorY > 260) {
      doc.addPage();
      cursorY = 20;
    }
  });

  // Guest anonymous contributions (visitors/regulars who didn't sign up)
  if (data.guestCount > 0) {
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text(`Guest Contributions — Anonymous (${data.guestCount})`, 14, cursorY);
    cursorY += 4;
    autoTable(doc, {
      startY: cursorY,
      head: [["Description", "Count", "Total (TZS)"]],
      body: [["Visitors & Regulars (unregistered)", String(data.guestCount), data.guestTotal.toLocaleString()]],
      headStyles: { fillColor: [30, 58, 95] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Grand total
  const allRows = CATEGORY_ORDER.flatMap((c) => data.sections[c]);
  const grandPledge = allRows.reduce((s, r) => s + r.pledge, 0);
  const grandContrib = allRows.reduce((s, r) => s + r.contribution, 0) + data.guestTotal;
  if (cursorY > 260) { doc.addPage(); cursorY = 20; }
  autoTable(doc, {
    startY: cursorY,
    head: [["Grand Total", "Pledge (TZS)", "Contribution (TZS)"]],
    body: [["All categories", grandPledge.toLocaleString(), grandContrib.toLocaleString()]],
    headStyles: { fillColor: [212, 160, 23], textColor: 20 },
    styles: { fontSize: 10, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  doc.save(`contributors-report-${new Date().toISOString().slice(0, 10)}.pdf`);
};

const exportExcel = (data: AdminExportData) => {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summary = buildSummary(data);
  const summaryAoa: (string | number)[][] = [
    ["Category", "People", "Pledge (TZS)", "Contribution (TZS)"],
    ...summary.map((s) => [s.cat, s.count, s.pledge, s.contribution]),
    ["Guest (Anonymous)", data.guestCount, 0, data.guestTotal],
    [
      "Grand Total",
      summary.reduce((s, x) => s + x.count, 0) + data.guestCount,
      summary.reduce((s, x) => s + x.pledge, 0),
      summary.reduce((s, x) => s + x.contribution, 0) + data.guestTotal,
    ],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  summaryWs["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // One sheet per category
  CATEGORY_ORDER.forEach((cat) => {
    const rows = data.sections[cat];
    const aoa: (string | number)[][] = [
      ["Full Name", "Phone", "Pledge (TZS)", "Contribution (TZS)"],
      ...rows.map((r) => [r.full_name, r.phone, r.pledge, r.contribution]),
      [
        "Subtotal",
        "",
        rows.reduce((s, r) => s + r.pledge, 0),
        rows.reduce((s, r) => s + r.contribution, 0),
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, cat);
  });

  XLSX.writeFile(wb, `contributors-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
          className="fixed inset-0 z-[100] grid min-h-dvh overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative m-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl"
            style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a3a5c 100%)" }}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
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

            <div className="shrink-0 flex gap-1 px-3 pt-3 overflow-x-auto">
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

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {tab === "settings" && <ChurchSettingsForm />}

              {tab === "users" && (
                <div className="space-y-4">
                  <div className="text-white">
                    <p className="font-semibold">Export Contributors Report</p>
                    <p className="text-xs text-white/60">
                      Documents are grouped into Members, Students, Regulars & Visitors with name, phone, pledge and contribution.
                    </p>
                  </div>

                  {usersQuery.isLoading ? (
                    <div className="p-8 flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {CATEGORY_ORDER.map((cat) => {
                          const count = usersQuery.data?.sections[cat].length ?? 0;
                          return (
                            <div key={cat} className="rounded-xl border border-white/10 bg-white/5 p-3 text-white">
                              <p className="text-xs text-white/60">{cat}</p>
                              <p className="text-xl font-bold">{count}</p>
                            </div>
                          );
                        })}
                      </div>

                      {(usersQuery.data?.guestCount ?? 0) > 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white text-sm">
                          <span className="text-white/60">Guest contributions (anonymous): </span>
                          <span className="font-semibold">
                            {usersQuery.data?.guestCount} · TZS{" "}
                            {usersQuery.data?.guestTotal.toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={() => usersQuery.data && exportPDF(usersQuery.data)}
                          disabled={!usersQuery.data}
                          className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-white border border-rose-400/40"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          onClick={() => usersQuery.data && exportExcel(usersQuery.data)}
                          disabled={!usersQuery.data}
                          className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-white border border-emerald-400/40"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Download Excel
                        </Button>
                      </div>
                    </>
                  )}
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
