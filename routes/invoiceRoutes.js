const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const path = require("path");
const fs = require("fs");
const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const User = require("../models/User"); // استيراد موديل المستخدم

router.get("/generateInvoice/:saleId", async (req, res) => {
  const saleId = req.params.saleId;

  try {
    // جلب بيانات العملية
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }

    // جلب بيانات المستخدم (يمكنك تعديل طريقة الجلب بحسب نظام المصادقة الخاص بك)
    const user = await User.findOne(); 
    // في حال عدم وجود بيانات مستخدم، استخدم قيم افتراضية
    const companyName = user?.name || "اسم الشركة";
    const companyAddress = user?.address || "عنوان الشركة";
    const companyPhone = user?.phone || "هاتف الشركة";
    const companyLogo = user?.logo || "https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg";

    // تنسيق تاريخ العملية
    const saleDate = new Date(sale.saleDate);
    const formattedDate = `${saleDate.getDate()}/${saleDate.getMonth() + 1}/${saleDate.getFullYear()}`;
    const formattedTime = `${saleDate.getHours()}:${saleDate.getMinutes()}:${saleDate.getSeconds()}`;

    // توليد رقم فاتورة بصيغة M****
    const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;

    // كود HTML للفاتورة مع تصميم مُحسّن وقسم بيانات الشركة والتوقيع
    const htmlContent = `
  <html lang="ar">
    <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Amiri&display=swap" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Amiri', serif;
          direction: rtl;
          text-align: right;
          background: #f7f7f7;
          padding: 20px;
          color: #333;
        }
        .invoice-container {
          max-width: 800px;
          margin: auto;
          background: #fff;
          border: 1px solid #ddd;
          padding: 30px;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .company-info {
          text-align: right;
        }
        .company-info p {
          margin: 5px 0;
          font-size: 16px;
        }
        .logo {
          width: 120px;
          height: auto;
        }
        .invoice-title {
          text-align: center;
          font-size: 32px;
          margin-bottom: 20px;
        }
        .invoice-details {
          margin-bottom: 20px;
        }
        .invoice-details p {
          margin: 8px 0;
          font-size: 18px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .table th, .table td {
          border: 1px solid #ddd;
          padding: 10px;
          font-size: 16px;
        }
        .table th {
          background: #f0f0f0;
        }
        .signature {
          text-align: left;
          font-size: 20px;
          margin-top: 40px;
        }
        .signature span {
          display: inline-block;
          border-top: 1px solid #333;
          padding-top: 5px;
          margin-top: 20px;
          width: 200px;
        }
        .emoji {
          font-family: 'Noto Color Emoji', sans-serif;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="company-info">
            <p class="emoji"><strong>اسم الشركة:</strong> ${companyName}</p>
            <p class="emoji"><strong>العنوان:</strong> ${companyAddress}</p>
            <p class="emoji"><strong>الهاتف:</strong> ${companyPhone}</p>
          </div>
          <div>
            <img src="${companyLogo}" alt="Logo" class="logo">
          </div>
        </div>
        <div class="invoice-title emoji">🧾 فاتورة بيع</div>
        <div class="invoice-details">
          <p class="emoji"><strong>📌 رقم الفاتورة:</strong> ${invoiceNumber}</p>
          <p class="emoji"><strong>📅 التاريخ:</strong> ${formattedDate}</p>
          <p class="emoji"><strong>⏰ الوقت:</strong> ${formattedTime}</p>
          <p class="emoji"><strong>👤 اسم العميل:</strong> ${sale.customerName}</p>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th class="emoji">📦 المنتج</th>
              <th class="emoji">🔢 الكمية</th>
              <th class="emoji">💰 السعر</th>
              <th class="emoji">💲 الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${sale.products.map((product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.quantity}</td>
                <td>${product.price} جنيه</td>
                <td>${product.quantity * product.price} جنيه</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="signature emoji">
          <p><strong>التوقيع:</strong></p>
          <span>ممدوحو</span>
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
