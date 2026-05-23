const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");

module.exports = {
  apps: [
    {
      name: "c2a-lap",
      cwd: path.join(rootDir, "server"),
      script: "src/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        HOST: process.env.HOST || "0.0.0.0",
        PORT: process.env.PORT || "5000",
        ADMIN_PORT: process.env.ADMIN_PORT || "5000",
        STORE_PORT: process.env.STORE_PORT || "5001",
      },
    },
  ],
};
