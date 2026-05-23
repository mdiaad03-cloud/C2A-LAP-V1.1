import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Unexpected application error.",
    };
  }

  componentDidCatch(error, info) {
    // Keep full details in the browser console for debugging.
    // eslint-disable-next-line no-console
    console.error("UI crash caught by ErrorBoundary:", error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("c2a_lap_session_v1");
      localStorage.removeItem("c2a_store_customer_session_v1");
      localStorage.removeItem("c2a_store_cart_v1");
    } catch {
      // Ignore storage cleanup errors.
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#f8fafc",
            color: "#0f172a",
            fontFamily: "Manrope, Segoe UI, sans-serif",
            padding: "24px",
          }}
        >
          <section
            style={{
              width: "min(560px, 100%)",
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.12)",
              borderRadius: "14px",
              boxShadow: "0 16px 36px rgba(15, 23, 42, 0.12)",
              padding: "18px",
            }}
          >
            <h1 style={{ marginTop: 0 }}>Application Error</h1>
            <p style={{ margin: "8px 0", color: "#475569" }}>
              The page crashed while rendering. Try clearing local session data and reloading.
            </p>
            <p style={{ margin: "8px 0", fontWeight: 700 }}>{this.state.message}</p>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                marginTop: "12px",
                border: 0,
                borderRadius: "10px",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
                background: "#f97316",
                color: "#ffffff",
              }}
            >
              Reset Session And Reload
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
