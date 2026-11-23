const express = require("express");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");

const config = require("./src/config");
const traceMiddleware = require("./src/api/middlewares/trace");
const errorHandler = require("./src/api/middlewares/errors");
const expressLayouts = require("express-ejs-layouts");

// Routes
const pageRoutes = require("./src/routes/pages.routes");
const dialogRoutes = require("./src/api/routes/dialog.routes");
const walletRoutes = require("./src/api/routes/wallet.routes");
const demoRoutes = require("./src/api/routes/demo.routes");
const audioRoutes = require("./src/api/routes/audio.routes");

const app = express();

/* ------------------------------------------------------------------ */
/*  1. Configuration du moteur de vues (EJS)                          */
/* ------------------------------------------------------------------ */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(expressLayouts);
app.set("layout", "layout"); // → views/layout.ejs
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

/* ------------------------------------------------------------------ */
/*  2. Middlewares fondamentaux                                        */
/* ------------------------------------------------------------------ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // CSS / JS / images
app.use(traceMiddleware);

/* ------------------------------------------------------------------ */
/*  3. Routes "pages" (HTML rendu via EJS)                             */
/* ------------------------------------------------------------------ */
app.use("/", pageRoutes);

// Route de Démo Réaliste
app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

/* ------------------------------------------------------------------ */
/*  4. Routes "API" (JSON)                                             */
/* ------------------------------------------------------------------ */
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    version: "0.1.0",
    services: { asr: "up", nlu: "up", tts: "up" },
  });
});

app.use("/api/v1/dialog", dialogRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/demo", demoRoutes);
app.use("/api/v1/audio", audioRoutes);

/* ------------------------------------------------------------------ */
/*  5. 404                                                            */
/*    - si la requête accepte du HTML  → page EJS                      */
/*    - sinon                            → JSON                        */
/* ------------------------------------------------------------------ */
app.use((req, res, next) => {
  const wantsHtml = req.accepts(["html", "json"]) === "html";

  if (wantsHtml) {
    return res.status(404).render("404", {
      title: "Page introuvable",
      traceId: req.traceId,
    });
  }

  return res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message_key: "error.not_found",
      message: "La ressource demandée n'existe pas.",
      trace_id: req.traceId,
    },
  });
});

/* ------------------------------------------------------------------ */
/*  6. Gestion globale d'erreurs                                      */
/* ------------------------------------------------------------------ */
app.use(errorHandler);

module.exports = app;
