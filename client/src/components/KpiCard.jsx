import { motion as Motion } from "framer-motion";

export default function KpiCard({ title, value, hint, icon: Icon, accent = "orange" }) {
  return (
    <Motion.article
      className={`kpi-card ${accent}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="kpi-top">
        <p>{title}</p>
        {Icon ? <Icon size={16} /> : null}
      </div>
      <h3>{value}</h3>
      {hint ? <span>{hint}</span> : null}
    </Motion.article>
  );
}
