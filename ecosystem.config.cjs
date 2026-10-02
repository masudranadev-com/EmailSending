module.exports = {
  apps: [
    {
      name: "email-sending-project",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
      },
    },
  ],
};
