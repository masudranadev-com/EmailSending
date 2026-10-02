const { spawnSync } = require("child_process");

const nextBin = require.resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
