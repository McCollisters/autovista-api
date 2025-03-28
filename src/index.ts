import express from "express";
import brandRoutes from "./brand/routes";

const app = express();
const port = "3050";

app.use("/", brandRoutes);

app.listen(port, () => {
  console.log(`Listening on PORT ${port}`);
});
