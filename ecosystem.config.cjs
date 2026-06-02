/** PM2 常驻进程配置：网站 + 每日 07:00 自动抓取 */
const path = require("path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "med-web",
      cwd: root,
      script: path.join(root, "node_modules/next/dist/bin/next"),
      args: "start -H 0.0.0.0 -p 3000",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "med-worker",
      cwd: root,
      script: "npm",
      args: "run worker",
      interpreter: "none",
      windowsHide: true,
      autorestart: true,
    },
  ],
};
