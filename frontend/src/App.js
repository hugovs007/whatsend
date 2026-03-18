import React, { useState, useEffect } from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { ptBR } from "@material-ui/core/locale";

// Error Boundary prevents the entire app from going blank when a child crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center" }}>
          <h2>Algo deu errado 😕</h2>
          <p style={{ color: "#888" }}>
            Erro: {this.state.error?.message || "Erro desconhecido"}
          </p>
          <button onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  const [locale, setLocale] = useState();

  const theme = createTheme(
    {
      scrollbarStyles: {
        "&::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
        },
        "&::-webkit-scrollbar-thumb": {
          boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
          backgroundColor: "#e8e8e8",
        },
      },
      palette: {
        primary: { main: "#2576d2" },
      },
    },
    locale
  );

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    if (!i18nlocale) return; // Guard: prevents crash on first visit when localStorage is empty

    const browserLocale =
      i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <Routes />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
