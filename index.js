const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const saleRoutes = require("./routes/saleRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const clientSupplierRoutes = require("./routes/clientSupplierRoutes");
const reportRoutes = require("./routes/reportRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "https://store-management-467c1.web.app",
  "https://smart-stock-one.vercel.app", // ← مهم جداً
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: function (origin, callback) {
      // السماح بـ Postman والـ server-to-server requests
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// ← حذف process.exit لأنه بيوقف Vercel
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
  console.error("خطأ: تأكد من إعداد المتغيرات البيئية");
  // process.exit(1);  // ← احذف هذا السطر
}

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/clients-suppliers", clientSupplierRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/invoices", invoiceRoutes);

io.on("connection", (socket) => {
  console.log("عميل متصل");
  socket.on("newSale", (data) => {
    io.emit("saleAdded", { message: "تم إضافة عملية بيع جديدة", sale: data });
  });
  socket.on("disconnect", () => {
    console.log("العميل مفصول");
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});