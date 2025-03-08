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
    const companyLogo = user?.logo || "https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg";
  
    // تنسيق تاريخ العملية
    const saleDate = new Date(sale.saleDate);
    const formattedDate = `${saleDate.getDate()}/${saleDate.getMonth() + 1}/${saleDate.getFullYear()}`;
    const formattedTime = `${saleDate.getHours()}:${saleDate.getMinutes()}:${saleDate.getSeconds()}`;
  
    // توليد رقم فاتورة بصيغة M****
    const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;
  
    // كود HTML المحسن للفاتورة
    const htmlContent = `
  <html lang="ar">
    <head>
      <meta charset="UTF-8">
      <!-- خطوط مخصصة -->
      <link href="https://fonts.googleapis.com/css2?family=Amiri&display=swap" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script&display=swap" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Amiri', serif;
          direction: rtl;
          text-align: right;
          background: #f2f2f2;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .invoice-container {
          width: 700px;
          min-height: 100vh;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #4a90e2, #357ab8);
          padding: 20px;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .company-info {
          text-align: right;
        }
        .company-info p {
          margin: 4px 0;
          font-size: 16px;
        }
        .logo {
          width: 120px;
          height: auto;
        }
        .invoice-body {
          padding: 20px;
        }
        .invoice-details {
          margin-bottom: 20px;
        }
        .invoice-details p {
          margin: 6px 0;
          font-size: 18px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .table th, .table td {
          border: 1px solid #ddd;
          padding: 4px;
          font-size: 16px;
          text-align: center;
        }
        .table th {
          background: #f0f0f0;
        }
        .signature {
          text-align: left;
          margin-top: 40px;
          font-size: 18px;
        }
        .signature .sig {
          font-family: 'Dancing Script', cursive;
          font-size: 36px;
          color: #357ab8;
          transform: rotate(-5deg);
          /* إزالة الخط السفلي لجعل التوقيع يبدو طبيعي */
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
            <img src="${companyLogo}" alt="Logo" class="logo">
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
              ${sale.products.map(product => `
                <tr>
                  <td>${product.productName}</td>
                  <td>${product.quantity}</td>
                  <td>${product.price} جنيه</td>
                  <td>${product.quantity * product.price} جنيه</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="signature">
            <p><strong>التوقيع:</strong></p>
            <div class="sig">${companyName}</div>
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
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" }
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
