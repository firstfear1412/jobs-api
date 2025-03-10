import express from "express";
// import database from "./service/database.js";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
// import productRoute from "./routes/productRoute.js";
// import memberRoute from "./routes/memberRoute.js";
// import cartRoute from "./routes/cartRoute.js";
// import dashboardRoute from "./routes/dashboard.route.js";
// import jobRoute from "./routes/job.route.js";

import routes from "./routes/index.js";
import swaggerDocs from "./config/swagger.config.js";

dotenv.config();

const app = express();
const port = process.env.PORT;

app.get("/", (req, res) => {
  console.log(`GET / requested`);
  res.status(200).json({
    message: "Request OK",
  });
});

app.use(bodyParser.json());

// Middleware
// app.use(cors());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "::1:5173"], //ให้ front เข้าถึงได้ตอนนี้ยังไม่มี
    method: ["GET", "POST", "PUT", "DELETE"],
    credentials: true, //ให้ส่งข้อมูล Header+Cookies ได้
  })
);

// Swagger
// const swaggerfile = fs.readFileSync("service/swagger.yaml", "utf-8");
// const swaggerDoc = yaml.parse(swaggerfile);
// // กำหนด path ที่จะให้เรียกหน้า Document ขึ้นมา
// app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDoc));

// Routes
app.use(routes);

// เชื่อมโยง route
// app.use(dashboardRoute);
// app.use(jobRoute);

swaggerDocs(app); // เรียกใช้การตั้งค่า Swagger

// // สร้าง Swagger docs
// const swaggerSpec = swaggerJsDoc(swaggerOptions);
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// // swaggerDocs(app);

// Handle 404
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
