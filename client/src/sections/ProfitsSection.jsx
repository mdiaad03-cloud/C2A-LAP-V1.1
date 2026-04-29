import { useState } from "react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "../utils/format";

const colors = ["#ff7a18", "#0f9d8f", "#4b7bec", "#f39c12", "#9b59b6", "#e74c3c"];

export default function ProfitsSection({
  summary,
  brandData,
  onExportExcel,
  onExportPdf,
  onClearProfits,
  lang = "en",
}) {
  const monthly = summary?.monthlyProfit || [];
  const leaderboard = summary?.employeePerformance || [];
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);
  const [clearing, setClearing] = useState(false);

  async function handleClearProfits() {
    if (!onClearProfits || clearing) {
      return;
    }

    const confirmed = window.confirm(
      tr(
        "Clear profit values for sales matching current filters?",
        "\u0645\u0633\u062d \u0642\u064a\u0645 \u0627\u0644\u0631\u0628\u062d \u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0628\u064a\u0639 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0641\u0644\u0627\u062a\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629\u061f",
      ),
    );
    if (!confirmed) {
      return;
    }

    setClearing(true);
    try {
      const clearedCount = await onClearProfits();
      toast.success(
        isArabic
          ? `\u062a\u0645 \u0645\u0633\u062d \u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0645\u0646 ${clearedCount} \u0633\u062c\u0644 \u0628\u064a\u0639.`
          : `Cleared profits from ${clearedCount} sales.`,
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          tr(
            "Failed to clear profits.",
            "\u0641\u0634\u0644 \u0645\u0633\u062d \u0627\u0644\u0623\u0631\u0628\u0627\u062d.",
          ),
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="section-stack">
      <section className="panel row-panel">
        <div className="panel-head row-head">
          <div>
            <h3>
              {tr(
                "Profits Analytics (Admin)",
                "\u062a\u062d\u0644\u064a\u0644\u0627\u062a \u0627\u0644\u0623\u0631\u0628\u0627\u062d (\u0627\u0644\u0625\u062f\u0627\u0631\u0629)",
              )}
            </h3>
            <span>
              {tr(
                "Financial visibility, trends, and employee performance.",
                "\u0645\u062a\u0627\u0628\u0639\u0629 \u0645\u0627\u0644\u064a\u0629 \u0643\u0627\u0645\u0644\u0629 \u0648\u0627\u062a\u062c\u0627\u0647\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621 \u0648\u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646.",
              )}
            </span>
          </div>
          <div className="inline-actions">
            <button className="secondary-btn" type="button" onClick={onExportExcel}>
              {tr("Export Excel", "\u062a\u0635\u062f\u064a\u0631 Excel")}
            </button>
            <button className="secondary-btn" type="button" onClick={onExportPdf}>
              {tr("Export PDF", "\u062a\u0635\u062f\u064a\u0631 PDF")}
            </button>
            <button className="secondary-btn" type="button" onClick={handleClearProfits} disabled={clearing}>
              {clearing
                ? tr(
                    "Clearing...",
                    "\u062c\u0627\u0631\u064d \u0627\u0644\u0645\u0633\u062d...",
                  )
                : tr(
                    "Clear Profits",
                    "\u0645\u0633\u062d \u0627\u0644\u0623\u0631\u0628\u0627\u062d",
                  )}
            </button>
          </div>
        </div>

        <div className="profit-cards">
          <article>
            <p>{tr("Total Revenue", "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a")}</p>
            <h4>{money.format(Number(summary?.totalRevenue || 0))}</h4>
          </article>
          <article>
            <p>{tr("Total Purchase Cost", "\u0625\u062c\u0645\u0627\u0644\u064a \u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u0631\u0627\u0621")}</p>
            <h4>{money.format(Number(summary?.totalPurchaseCost || 0))}</h4>
          </article>
          <article>
            <p>{tr("Total Shipping Cost", "\u0625\u062c\u0645\u0627\u0644\u064a \u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u062d\u0646")}</p>
            <h4>{money.format(Number(summary?.totalShippingCost || 0))}</h4>
          </article>
          <article>
            <p>{tr("Net Profit", "\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d")}</p>
            <h4>{money.format(Number(summary?.netProfit || 0))}</h4>
          </article>
          <article>
            <p>{tr("Best Selling Brand", "\u0623\u0641\u0636\u0644 \u0645\u0627\u0631\u0643\u0629 \u0645\u0628\u064a\u0639\u064b\u0627")}</p>
            <h4>{summary?.bestSellingBrand || "-"}</h4>
          </article>
        </div>
      </section>

      <section className="charts-grid two">
        <article className="panel chart-panel">
          <h4>{tr("Monthly Net Profit", "\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d \u0627\u0644\u0634\u0647\u0631\u064a")}</h4>
          <ResponsiveContainer width="100%" height={290}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ff7a18" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="panel chart-panel">
          <h4>{tr("Performance by Employee", "\u0627\u0644\u0623\u062f\u0627\u0621 \u062d\u0633\u0628 \u0627\u0644\u0645\u0648\u0638\u0641")}</h4>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={leaderboard}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="employeeName" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="profit" fill="#0f9d8f" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="panel chart-panel">
          <h4>{tr("Brand Distribution", "\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0645\u0627\u0631\u0643\u0627\u062a")}</h4>
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie data={brandData} dataKey="value" nameKey="name" outerRadius={110}>
                {brandData.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article className="panel table-panel">
          <h4>{tr("Sales Ranking Leaderboard", "\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a")}</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("Employee", "\u0627\u0644\u0645\u0648\u0638\u0641")}</th>
                  <th>{tr("Sales Count", "\u0639\u062f\u062f \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a")}</th>
                  <th>{tr("Revenue", "\u0627\u0644\u0625\u064a\u0631\u0627\u062f")}</th>
                  <th>{tr("Profit", "\u0627\u0644\u0631\u0628\u062d")}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={4}>{tr("No data.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a.")}</td>
                  </tr>
                ) : (
                  leaderboard.map((item) => (
                    <tr key={item.employeeId}>
                      <td>{item.employeeName}</td>
                      <td>{item.salesCount}</td>
                      <td>{money.format(Number(item.revenue || 0))}</td>
                      <td>{money.format(Number(item.profit || 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
