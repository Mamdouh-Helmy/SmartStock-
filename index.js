const express = require('express');
const cors = require('cors');
const http = require('http'); // لاستعمال http server مع Socket.IO
const { Server } = require('socket.io'); // لاستعمال Socket.IO
require('dotenv').config();  // لقراءة متغيرات البيئة من ملف .env
const connectDB = require('./config/db'); // استيراد الاتصال بقاعدة البيانات
const authRoutes = require('./routes/authRoutes');
const saleRoutes = require('./routes/saleRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const clientSupplierRoutes = require('./routes/clientSupplierRoutes');
const reportRoutes = require('./routes/reportRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');

const app = express();
const server = http.createServer(app); // استخدام http server لتشغيل Socket.IO
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'https://stockmaster-4dbcc.web.app'], // السماح للموقع المحلي + موقع Firebase
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

// ✅ إعداد CORS
app.use(cors({
  origin: ['http://localhost:5173', 'https://stockmaster-4dbcc.web.app'], // السماح للموقع المحلي + موقع Firebase
  credentials: true,
}));

app.use(express.json());

// ✅ التحقق من متغيرات البيئة
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
  console.error('❌ خطأ: تأكد من إعداد المتغيرات البيئية في ملف .env');
  process.exit(1);
}

// ✅ الاتصال بقاعدة بيانات MongoDB
connectDB();

// ✅ ربط المسارات
app.use('/api/auth', authRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/clients-suppliers', clientSupplierRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/invoices', invoiceRoutes); // إضافة مسار الفواتير

// ✅ إعداد Socket.IO
io.on('connection', (socket) => {
  console.log('⚡ عميل متصل');

  // استقبال حدث "newSale" من العميل
  socket.on('newSale', (data) => {
    console.log('✅ تم إضافة عملية بيع جديدة:', data);
    io.emit('saleAdded', { message: 'تم إضافة عملية بيع جديدة', sale: data }); // إرسال إشعار للجميع
  });

  socket.on('disconnect', () => {
    console.log('❌ العميل مفصول');
  });
});

// ✅ تشغيل الخادم مع Socket.IO ومنع الإغلاق التلقائي
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

// ✅ منع Railway من إيقاف السيرفر تلقائيًا
process.stdin.resume();
