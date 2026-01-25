module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json", "./apps/web/tsconfig.json"]
  },
  settings: {
    next: {
      rootDir: ["apps/web"]
    }
  }
};
