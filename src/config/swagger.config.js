import swaggerUi from "swagger-ui-express";
import swaggerJsDoc from "swagger-jsdoc";
import yaml from "yaml";
import fs from "fs";
import path from "path";

// แปลง __dirname สำหรับการใช้ใน ESModules
import { fileURLToPath } from "url";
import { dirname } from "path"; // เพิ่มการนำเข้า dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const swaggerfile = fs.readFileSync("src/config/swagger.yaml", "utf-8");
// const swaggerDoc = yaml.parse(swaggerfile);
const swaggerfile = fs.readFileSync(
  path.join(__dirname, "./swagger.yaml"),
  "utf-8"
);
const swaggerDoc = yaml.parse(swaggerfile);

// const swaggerOptions = {
//   //   definition: swaggerDoc, // ใช้ข้อมูลที่อ่านจากไฟล์ swagger.yaml ทั้งหมด
//   // ใช้ path.join(__dirname) เพื่อให้เส้นทางถูกต้อง
//   apis: [path.join(__dirname, "src/routes/**/*.js")], // ตรวจสอบไฟล์ทุกไฟล์ใน folder routes
// };

const swaggerOptions = {
  definition: swaggerDoc,
  apis: [path.join(__dirname, "../routes/**/*.js")], // ใช้เส้นทางสำหรับไฟล์ route
};

console.log("src/routes/**/*.js");

const swaggerDocs = (app) => {
  const swaggerSpec = swaggerJsDoc(swaggerOptions);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log("Swagger Docs available at http://localhost:3000/api-docs");
};

export default swaggerDocs;
// export default swaggerOptions;
