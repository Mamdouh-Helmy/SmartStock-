const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const path = require("path");
const fs = require("fs");
const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const User = require("../models/User");

router.get("/generateInvoice/:saleId", async (req, res) => {
  const saleId = req.params.saleId;
  try {
    // جلب بيانات العملية
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }
    // جلب بيانات المستخدم واستخدام بيانات الشركة
    const user = await User.findOne();
    const companyName = user?.name || "اسم الشركة";
    const companyAddress = user?.address || "عنوان الشركة";
    const companyPhone = user?.phone || "هاتف الشركة";
    const companyLogo =
      user?.logo ||
      "https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg";
    
    // استخدام الوقت والتاريخ الحالي مع تحديد المنطقة الزمنية المطلوبة (مثلاً منطقة القاهرة)
    const now = new Date();
    const options = { timeZone: 'Africa/Cairo', hour12: false };
    const formattedDate = now.toLocaleDateString('ar-EG', options);
    const formattedTime = now.toLocaleTimeString('ar-EG', options);
    
    // توليد رقم فاتورة بصيغة M****
    const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;
    
    // حساب الإجمالي العام
    const totalAmount = sale.products.reduce(
      (acc, product) => acc + product.quantity * product.price,
      0
    );
    
    // التحقق مما إذا كان الاسم يحتوي على حروف عربية
    const isArabic = /[\u0600-\u06FF]/.test(companyName);
    
    // كود HTML للفاتورة مع التصميم المحسن
    const htmlContent = `
<html lang="ar">
  <head>
    <meta charset="UTF-8" />
    <title>فاتورة المبيعات</title>
    <!-- استيراد خطوط Google -->
    <link href="https://fonts.googleapis.com/css2?family=Amiri&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Satisfy&display=swap" rel="stylesheet" />
    <style>
      body {
        background: #f2f2f2;
        font-family: 'Amiri', serif;
        margin: 0;
        padding: 20px;
        direction: rtl;
        text-align: right;
      }
      .invoice-container {
        max-width: 800px;
        margin: 0 auto;
        background: #fff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
      }
      .header {
        background: linear-gradient(135deg, #2c3e50, #34495e);
        color: #ecf0f1;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .company-info p {
        margin: 5px 0;
        font-size: 18px;
      }
      .logo {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border: 2px solid #fff;
        object-fit: cover;
      }
      .invoice-body {
        padding: 20px;
      }
      .invoice-details p {
        margin: 8px 0;
        font-size: 16px;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      .table th,
      .table td {
        border: 1px solid #ddd;
        padding: 12px;
        font-size: 16px;
        text-align: center;
      }
      .table th {
        background: #ecf0f1;
      }
      .total {
        text-align: right;
        font-size: 20px;
        margin-top: 20px;
        font-weight: bold;
      }
      .signature {
        margin-top: 20px;
        text-align: center;
      }
      /* تصميم توقيع مع تأثير تدرج وظل للنص */
      .signature .sig-text[lang="ar"],
      .signature .sig-text[lang="en"] {
        font-size: 48px;
        background: linear-gradient(45deg, #2c3e50, #ff0099);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        transform: rotate(-3deg);
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      }
      .signature .sig-text[lang="en"] {
        font-family: 'Satisfy', cursive;
      }
      .signature p {
        margin-top: 10px;
        font-size: 16px;
        color: #333;
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="header">
        <div class="company-info">
          <p><strong>اسم الشركة:</strong> ${companyName}</p>
          <p><strong>العنوان:</strong> ${companyAddress}</p>
          <p><strong>الهاتف:</strong> ${companyPhone}</p>
        </div>
        <div>
          <img src="${companyLogo}" alt="Logo" class="logo" />
        </div>
      </div>
      <div class="invoice-body">
        <div class="invoice-details">
          <p><strong>رقم الفاتورة:</strong> ${invoiceNumber}</p>
          <p><strong>التاريخ:</strong> ${formattedDate}</p>
          <p><strong>الوقت:</strong> ${formattedTime}</p>
          <p><strong>اسم العميل:</strong> ${sale.customerName}</p>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${sale.products
              .map(
                (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.quantity}</td>
                <td>${product.price} جنيه</td>
                <td>${product.quantity * product.price} جنيه</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div class="total">
          <p>المجموع: ${totalAmount} جنيه</p>
        </div>
        <div class="signature">
          <p><strong>التوقيع:</strong></p>
          <!-- تحديد لغة التوقيع بناءً على محتوى الاسم -->
          <span class="sig-text" lang="${isArabic ? "ar" : "en"}">${companyName}</span>
          <p>شكراً لتعاملكم معانا</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

    console.log("🚀 بدء تشغيل Puppeteer...");
    const browser = await puppeteer.launch({
      headless: chromium.headless,
      executablePath: await chromium.executablePath(),
      args: chromium.args,
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });
    console.log("📄 إنشاء ملف PDF...");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });
    await browser.close();
    console.log("✅ تم إنشاء PDF بنجاح!");
    const invoicesDir = path.join(__dirname, "../invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }
    const filePath = path.join(invoicesDir, `invoice_${saleId}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${saleId}.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.download(filePath);
  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    res.status(500).json({ message: "خطأ في إنشاء الفاتورة" });
  }
});

module.exports = router;




// const PDFDocument = require("pdfkit");
// const fs = require("fs").promises;
// const path = require("path");
// const express = require("express");
// const router = express.Router();
// const Sale = require("../models/Sale");
// const User = require("../models/User");

// router.get("/generateInvoice/:saleId", async (req, res) => {
//   const saleId = req.params.saleId;
//   try {
//     const sale = await Sale.findById(saleId);
//     if (!sale) {
//       return res.status(404).json({ message: "العملية غير موجودة" });
//     }
//     const user = await User.findOne();
//     const companyName = user?.name || "اسم الشركة";
//     const companyAddress = user?.address || "عنوان الشركة";
//     const companyPhone = user?.phone || "هاتف الشركة";

//     const now = new Date();
//     const options = { timeZone: "Africa/Cairo", hour12: false };
//     const formattedDate = now.toLocaleDateString("ar-EG", options);
//     const formattedTime = now.toLocaleTimeString("ar-EG", options);
//     const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;
//     const totalAmount = sale.products.reduce(
//       (acc, product) => acc + product.quantity * product.price,
//       0
//     );

//     // إنشاء مستند PDF جديد
//     const doc = new PDFDocument({
//       size: "A4",
//       layout: "portrait",
//       bufferPages: true,
//     });

//     // إعداد الخط باستخدام Base64
//     const amiriFontBase64 = "YOUR_BASE64_ENCODED_AMIRI_FONT_HERE"; // استبدل بنص Base64
//     try {
//       doc.registerFont("Amiri", Buffer.from(amiriFontBase64, "base64"));
//       doc.font("Amiri");
//     } catch (fontError) {
//       console.error("❌ خطأ في تحميل خط Amiri:", fontError);
//       doc.font("Helvetica"); // استخدام خط بديل
//     }
//     doc.fontSize(12);

//     // إعداد تدفق لتخزين ملف PDF
//     const invoicesDir = "/tmp/invoices";
//     await fs.mkdir(invoicesDir, { recursive: true });
//     const filePath = path.join(invoicesDir, `invoice_${saleId}.pdf`);
//     const writeStream = require("fs").createWriteStream(filePath);
//     doc.pipe(writeStream);

//     // إضافة محتوى الفاتورة (من اليمين لليسار)
//     const pageWidth = doc.page.width; // عرض الصفحة (595 نقطة لـ A4)
//     const margin = 50;
//     const rightEdge = pageWidth - margin;

//     doc.text(`اسم الشركة: ${companyName}`, rightEdge, 50, { align: "right" });
//     doc.text(`العنوان: ${companyAddress}`, rightEdge, 60, { align: "right" });
//     doc.text(`الهاتف: ${companyPhone}`, rightEdge, 70, { align: "right" });
//     doc.text(`رقم الفاتورة: ${invoiceNumber}`, rightEdge, 80, {
//       align: "right",
//     });
//     doc.text(`التاريخ: ${formattedDate}`, rightEdge, 90, { align: "right" });
//     doc.text(`الوقت: ${formattedTime}`, rightEdge, 100, { align: "right" });
//     doc.text(`اسم العميل: ${sale.customerName}`, rightEdge, 110, {
//       align: "right",
//     });

//     // إنشاء جدول يدويًا
//     const tableTop = 130;
//     const rowHeight = 20;
//     const columnWidths = [200, 100, 100, 100];
//     const tableHeaders = ["المنتج", "الكمية", "السعر", "الإجمالي"];

//     // رسم رأس الجدول
//     doc.fontSize(10);
//     let x = rightEdge;
//     for (let i = 0; i < tableHeaders.length; i++) {
//       doc.text(tableHeaders[i], x - columnWidths[i], tableTop, {
//         width: columnWidths[i],
//         align: "right",
//       });
//       x -= columnWidths[i];
//     }

//     // رسم خط أفقي تحت رأس الجدول
//     doc
//       .moveTo(margin, tableTop + 15)
//       .lineTo(pageWidth - margin, tableTop + 15)
//       .stroke();

//     // إضافة بيانات الجدول
//     let y = tableTop + rowHeight;
//     sale.products.forEach((product) => {
//       x = rightEdge;
//       doc.text(product.productName, x - columnWidths[0], y, {
//         width: columnWidths[0],
//         align: "right",
//       });
//       x -= columnWidths[0];
//       doc.text(product.quantity.toString(), x - columnWidths[1], y, {
//         width: columnWidths[1],
//         align: "right",
//       });
//       x -= columnWidths[1];
//       doc.text(product.price.toString(), x - columnWidths[2], y, {
//         width: columnWidths[2],
//         align: "right",
//       });
//       x -= columnWidths[2];
//       doc.text(
//         (product.quantity * product.price).toString(),
//         x - columnWidths[3],
//         y,
//         {
//           width: columnWidths[3],
//           align: "right",
//         }
//       );
//       y += rowHeight;
//     });

//     // رسم خط أفقي تحت الجدول
//     doc
//       .moveTo(margin, y + 5)
//       .lineTo(pageWidth - margin, y + 5)
//       .stroke();

//     // إضافة المجموع
//     doc.text(`المجموع: ${totalAmount} جنيه`, rightEdge, y + 15, {
//       align: "right",
//     });

//     // إنهاء المستند
//     doc.end();

//     // الانتظار حتى ينتهي تدفق الكتابة
//     await new Promise((resolve) => writeStream.on("finish", resolve));

//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=invoice_${saleId}.pdf`
//     );
//     res.setHeader("Content-Type", "application/pdf");
//     res.sendFile(filePath, async (err) => {
//       if (err) {
//         console.error("❌ خطأ أثناء إرسال الملف:", err);
//         res.status(500).json({ message: "خطأ في إرسال الفاتورة" });
//       }
//       try {
//         await fs.unlink(filePath);
//         console.log("🗑️ تم حذف ملف الفاتورة بنجاح");
//       } catch (unlinkErr) {
//         console.error("❌ خطأ أثناء حذف الملف:", unlinkErr);
//       }
//     });
//   } catch (err) {
//     console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
//     res
//       .status(500)
//       .json({ message: "خطأ في إنشاء الفاتورة", error: err.message });
//   }
// });

// module.exports = router;


