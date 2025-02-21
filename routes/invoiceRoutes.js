const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
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

    const saleDate = new Date(sale.saleDate);
    const formattedDate = `${saleDate.getDate()}/${
      saleDate.getMonth() + 1
    }/${saleDate.getFullYear()}`;
    const formattedTime = `${saleDate.getHours()}:${saleDate.getMinutes()}:${saleDate.getSeconds()}`;

    const invoiceNumber = `#${saleId}`;

    const htmlContent = `
  <html lang="ar">
    <head>
      <meta charset="UTF-8">
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
          font-size: 18px;
        }
        .emoji {
          font-family: 'Noto Color Emoji', sans-serif;
        }
        .title {
          font-size: 30px;
          text-align: center;
          margin-top: 60px;
        }
        .header{
          width: 90%;
          margin-top: 20px;
          margin-left: auto;
          margin-right: auto;
        }
        .header p {
          font-size: 16px; 
          margin: 12px 0; 
          display: block; 
          line-height: 2.1;
        }
        .header p .two {
          font-family: 'Arial', sans-serif;
        }
        .emoji span {
          display: inline;
          letter-spacing: 2px;
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
      <div class="title emoji">🧾 فاتورة بيع</div>
      <div class="header">
       <p class="emoji">
  <span>📌 رقم الفاتورة:</span> <span class="two">${invoiceNumber}</span>
</p>
<p class="emoji">
  <span>📅 التاريخ:</span> <span  class="two">${formattedDate}</span>
</p>
<p class="emoji">
  <span>⏰ الوقت:</span> <span  class="two">${formattedTime}</span>
</p>
<p class="emoji">
  <span>👤 اسم العميل:</span> <span  class="two">${sale.customerName}</span>
</p>

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
