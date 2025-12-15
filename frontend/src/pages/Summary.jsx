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
} from "recharts";

export default function Summary() {
    const [month, setMonth] = useState("2025-12");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    function exportSummaryCSV(data, month) {
        if (!data) return;

        const rows = [];

        rows.push(["Month", month]);
        rows.push(["Total Expense", data.total_expense]);
        rows.push(["Total Income", data.total_income]);
        rows.push([
            "Net Balance",
            data.total_income - data.total_expense,
        ]);
        rows.push([]); // empty line

        rows.push(["Category", "Amount", "Percentage"]);

        Object.entries(data.by_category || {}).forEach(
            ([category, amount]) => {
                const percent =
                    data.total_expense > 0
                        ? ((amount / data.total_expense) * 100).toFixed(2)
                        : 0;

                rows.push([category, amount, `${percent}%`]);
            }
        );

        const csvContent = rows
            .map((row) => row.join(","))
            .join("\n");

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `summary-${month}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }


    useEffect(() => {
        async function load() {
            setLoading(true);
            setError("");
            try {
                const res = await getMonthlySummary(month);
                setData(res);
            } catch (err) {
                setError("Failed to load summary");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [month]);

    const chartData =
        data &&
        Object.entries(data.by_category || {}).map(([category, amount]) => ({
            category,
            amount,
        }));

    const netBalance = data
        ? data.total_income - data.total_expense
        : 0;


    return (
        <AppLayout>
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <h2 className="text-3xl font-semibold">Monthly Summary</h2>

                <div className="flex gap-3">
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 rounded"
                    />

                    <button
                        onClick={() => exportSummaryCSV(data, month)}
                        disabled={loading || !data}
                        className="bg-sky-500/20 text-sky-400 px-4 py-2 rounded
                 hover:bg-sky-500/30 transition
                 disabled:opacity-50"
                    >
                        Export CSV
                    </button>
                </div>
            </div>


            {loading && <div className="text-slate-400">Loading summary…</div>}
            {error && <div className="text-red-400">{error}</div>}

            {!loading && data && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <SummaryCard
                            title="Total Expense"
                            value={`₹ ${data.total_expense}`}
                            color="text-red-400"
                        />

                        <SummaryCard
                            title="Total Income"
                            value={`₹ ${data.total_income}`}
                            color="text-emerald-400"
                        />

                        <SummaryCard
                            title="Net Balance"
                            value={`₹ ${netBalance}`}
                            color={
                                netBalance >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                            }
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Chart */}
                        <div className="bg-slate-900 p-6 rounded-lg h-80">
                            <h3 className="font-medium mb-4">Spending by Category</h3>

                            {chartData.length === 0 ? (
                                <div className="text-slate-400">
                                    No category data available
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                                        <XAxis dataKey="category" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "#020617",
                                                border: "1px solid #1e293b",
                                                color: "#e5e7eb",
                                            }}
                                        />
                                        <Bar dataKey="amount" fill="#38bdf8" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Category Breakdown */}
                        <div className="bg-slate-900 p-6 rounded-lg">
                            <h3 className="font-medium mb-4">Category Breakdown</h3>

                            <div className="space-y-3">
                                {Object.entries(data.by_category || {}).map(
                                    ([cat, amt]) => {
                                        const percent =
                                            data.total_expense > 0
                                                ? ((amt / data.total_expense) * 100).toFixed(1)
                                                : 0;

                                        return (
                                            <div
                                                key={cat}
                                                className="flex justify-between items-center text-sm"
                                            >
                                                <span className="text-slate-300">{cat}</span>
                                                <span className="text-slate-200">
                                                    ₹ {amt}{" "}
                                                    <span className="text-slate-500">
                                                        ({percent}%)
                                                    </span>
                                                </span>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}

function SummaryCard({ title, value, color }) {
    return (
        <div className="bg-slate-900 p-5 rounded-lg">
            <div className="text-slate-400 text-sm">{title}</div>
            <div className={`text-2xl mt-1 ${color}`}>{value}</div>
        </div>
    );
}
