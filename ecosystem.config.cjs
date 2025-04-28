module.exports = {
  apps: [
    {
      name: "edu-schedule",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};