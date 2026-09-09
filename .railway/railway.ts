import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const app = service("SMART-INVENTORY-MANAGEMENT", {
    source: github("nithishkamaraj7778-hash/SMART-INVENTORY-MANAGEMENT", {
      branch: "main",
      rootDirectory: null,
    }),
    start: "npm start",
    healthcheck: "/health",
    healthcheckTimeout: 100,
  });

  return project("grand-respect", { resources: [app] });
});