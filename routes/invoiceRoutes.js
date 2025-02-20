const puppeteer = require("puppeteer-core"); // استخدام puppeteer-core
const path = require("path");
const fs = require("fs");
const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");

router.get("/generateInvoice/:saleId", async (req, res) => {
  const saleId = req.params.saleId;

  try {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }

    // تنسيق التاريخ والوقت
    const saleDate = new Date(sale.saleDate);
    const formattedDate = `${saleDate.getDate()}/${
      saleDate.getMonth() + 1
    }/${saleDate.getFullYear()}`;
    const formattedTime = `${saleDate.getHours()}:${saleDate.getMinutes()}:${saleDate.getSeconds()}`;

    // **توليد رقم فاتورة مختصر**
    const invoiceNumber = `#${saleId}`;

    // إعداد HTML مع الإيموجي
    const htmlContent = `
  <html lang="ar">
    <head>
      <meta charset="UTF-8">
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
          font-size: 18px;
        }
        .emoji {
          font-family: 'NotoColorEmoji', sans-serif;
        }
        .title {
          font-size: 30px;
          text-align: center;
          margin-top: 60px;
        }
        .header {
          font-size: 18px;
          margin: 10px 0;
        }
        p {
          font-size: 23px;
        }
        .table {
          width: 90%;
          margin-top: 20px;
          margin-left: auto;
          margin-right: auto;
          border-collapse: collapse;
        }
        .table th, .table td {
          padding: 10px;
          text-align: right;
          border: 1px solid #ddd;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="title">🧾 فاتورة بيع</div>
      <div class="header">
        <p>📌 رقم الفاتورة: ${invoiceNumber}</p>
        <p>📅 التاريخ: ${formattedDate}</p>
        <p>⏰ الوقت: ${formattedTime}</p>
        <p>👤 اسم العميل: ${sale.customerName}</p>
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
    </body>
  </html>
`;

    // **🔹 تشغيل Puppeteer مع التعديلات الجديدة**
    const browser = await puppeteer.launch({
      headless: true, // تشغيل المتصفح بدون واجهة
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', // استخدام Chromium من النظام
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // تعطيل Sandbox لتجنب المشاكل
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    // **🔹 التأكد من وجود مجلد `invoices`**
    const invoicesDir = path.join(__dirname, "../invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const filePath = path.join(invoicesDir, `invoice_${saleId}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);

    // **🔹 إرسال الفاتورة للتحميل**
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${saleId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.download(filePath);
  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    res.status(500).json({ message: "خطأ في إنشاء الفاتورة" });
  }
});

module.exports = router;
