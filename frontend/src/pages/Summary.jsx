import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { getMonthlySummary } from "../api/sms";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell
} from "recharts";

// Colors for the chart bars to make it look professional
const COLORS = ['#38bdf8', '#818cf8', '#fb7185', '#fbbf24', '#34d399', '#a78bfa'];

export default function Summary() {
    // 🔥 FIX: Automatically set to current month (YYYY-MM)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [month, setMonth] = useState(currentMonth);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    function exportSummaryCSV(summaryData, selectedMonth) {
        if (!summaryData) return;

        const rows = [];
        rows.push(["Month", selectedMonth]);
        rows.push(["Total Expense", summaryData.total_expense]);
        rows.push(["Total Income", summaryData.total_income]);
        rows.push(["Net Balance", summaryData.total_income - summaryData.total_expense]);
        rows.push([]);

        rows.push(["Category", "Amount", "Percentage"]);
        Object.entries(summaryData.by_category || {}).forEach(([category, amount]) => {
            const percent = summaryData.total_expense > 0
                ? ((amount / summaryData.total_expense) * 100).toFixed(2)
                : 0;
            rows.push([category, amount, `${percent}%`]);
        });

        const csvContent = rows.map((row) => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `expense-summary-${selectedMonth}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError("");
            try {
                const res = await getMonthlySummary(month);
                // Handle different response structures (axios vs fetch)
                const finalData = res.data || res;
                setData(finalData);
            } catch (err) {
                console.error("Summary Load Error:", err);
                setError("Failed to load summary for the selected month.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [month]);

    // Format data for Recharts - Filter out "Income" from the spending bar chart
    const chartData = data?.by_category
        ? Object.entries(data.by_category)
            .filter(([category]) => category !== "Income") // Don't show income in expense chart
            .map(([category, amount]) => ({
                category,
                amount: parseFloat(amount) || 0,
            }))
        : [];

    const netBalance = data ? (data.total_income - data.total_expense) : 0;

    return (
        <AppLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">Financial Summary</h2>
                    <p className="text-slate-400">Overview for {new Date(month + "-02").toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        onClick={() => exportSummaryCSV(data, month)}
                        disabled={loading || !data}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : error ? (
                <div className="bg-red-900/20 border border-red-500 text-red-400 p-6 rounded-lg text-center">
                    {error}
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <SummaryCard
                            title="Total Monthly Expense"
                            value={`₹ ${data.total_expense?.toLocaleString() || 0}`}
                            color="text-rose-400"
                            borderColor="border-rose-500/50"
                        />
                        <SummaryCard
                            title="Total Monthly Income"
                            value={`₹ ${data.total_income?.toLocaleString() || 0}`}
                            color="text-emerald-400"
                            borderColor="border-emerald-500/50"
                        />
                        <SummaryCard
                            title="Net Savings"
                            value={`₹ ${netBalance.toLocaleString()}`}
                            color={netBalance >= 0 ? "text-sky-400" : "text-rose-400"}
                            borderColor={netBalance >= 0 ? "border-sky-500/50" : "border-rose-500/50"}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Spending Chart */}
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl">
                            <h3 className="text-lg font-semibold mb-6 text-slate-200">Expense Distribution</h3>
                            <div className="h-72">
                                {chartData.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-500 italic">
                                        No expense data found for this month.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                cursor={{ fill: '#1e293b' }}
                                                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: '8px' }}
                                                itemStyle={{ color: "#f8fafc" }}
                                            />
                                            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Category List */}
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl">
                            <h3 className="text-lg font-semibold mb-6 text-slate-200">Breakdown by Category</h3>
                            <div className="space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                {Object.entries(data.by_category || {}).length === 0 ? (
                                    <div className="text-slate-500 italic">No activity recorded.</div>
                                ) : (
                                    Object.entries(data.by_category || {}).map(([cat, amt]) => {
                                        const isIncome = cat === "Income";
                                        const percent = !isIncome && data.total_expense > 0
                                            ? ((amt / data.total_expense) * 100).toFixed(1)
                                            : null;

                                        return (
                                            <div key={cat} className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-300 font-medium">{cat}</span>
                                                    <span className={isIncome ? "text-emerald-400" : "text-white"}>
                                                        ₹ {amt.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${isIncome ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${isIncome ? 100 : percent || 0}%` }}
                                                    ></div>
                                                </div>
                                                {percent && <span className="text-[10px] text-slate-500 text-right">{percent}% of expenses</span>}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}

function SummaryCard({ title, value, color, borderColor }) {
    return (
        <div className={`bg-slate-900/40 p-6 rounded-xl border-l-4 ${borderColor} shadow-lg`}>
            <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold">{title}</div>
            <div className={`text-3xl font-bold mt-2 font-mono ${color}`}>{value}</div>
        </div>
    );
}