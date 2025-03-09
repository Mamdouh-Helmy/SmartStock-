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
    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ message: "العملية غير موجودة" });

    const user = await User.findOne();
    const companyName = user?.name || "اسم الشركة";
    const companyAddress = user?.address || "عنوان الشركة";
    const companyPhone = user?.phone || "هاتف الشركة";
    const companyEmail = user?.email || "البريد الإلكتروني";
    const companyLogo = user?.logo || "https://example.com/default-logo.jpg";

    const saleDate = new Date(sale.saleDate);
    const formattedDate = new Intl.DateTimeFormat('ar-EG', { 
      dateStyle: 'full' 
    }).format(saleDate);

    const invoiceNumber = `INV-${saleDate.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const totalAmount = sale.products.reduce(
      (acc, product) => acc + product.quantity * product.price,
      0
    );

    const isArabic = /[\u0600-\u06FF]/.test(companyName);

    const htmlContent = `
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة ${invoiceNumber}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Tajawal', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f8f9fa;
      padding: 30px;
    }

    .invoice-container {
      max-width: 1000px;
      margin: 0 auto;
      background: #fff;
      border-radius: 15px;
      box-shadow: 0 0 30px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #2c3e50, #3498db);
      color: white;
      padding: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 5px solid #2980b9;
    }

    .company-info {
      flex: 1;
    }

    .company-info h1 {
      font-size: 2.5rem;
      margin-bottom: 15px;
      color: #fff;
    }

    .company-info p {
      font-size: 1.1rem;
      margin: 8px 0;
      opacity: 0.9;
    }

    .logo-container {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      overflow: hidden;
      border: 3px solid #fff;
      box-shadow: 0 0 15px rgba(0,0,0,0.2);
    }

    .logo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .invoice-body {
      padding: 40px;
    }

    .invoice-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
    }

    .invoice-number {
      font-size: 1.8rem;
      color: #2c3e50;
      font-weight: 700;
    }

    .invoice-details p {
      font-size: 1.1rem;
      margin: 8px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      background: #fff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 10px rgba(0,0,0,0.1);
    }

    th {
      background: #3498db;
      color: white;
      padding: 15px;
      text-align: center;
      font-weight: 700;
    }

    td {
      padding: 12px;
      text-align: center;
      border-bottom: 1px solid #eee;
    }

    tr:nth-child(even) {
      background-color: #f8f9fa;
    }

    .total-section {
      text-align: left;
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }

    .total-label {
      font-size: 1.3rem;
      color: #2c3e50;
      font-weight: 700;
    }

    .total-amount {
      font-size: 2rem;
      color: #27ae60;
      font-weight: 700;
      margin-top: 10px;
    }

    .signature-section {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px dashed #ddd;
      text-align: center;
    }

    .signature {
      display: inline-block;
      padding: 20px 40px;
      background: linear-gradient(45deg, #3498db, #2980b9);
      border-radius: 10px;
      transform: rotate(-3deg);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }

    .signature-text {
      font-family: 'Satisfy', cursive;
      font-size: 2.5rem;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .footer {
      background: #2c3e50;
      color: white;
      padding: 20px;
      text-align: center;
      margin-top: 40px;
    }

    .footer p {
      margin: 5px 0;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>${companyName}</h1>
        <p>${companyAddress}</p>
        <p>📞 ${companyPhone}</p>
        <p>✉️ ${companyEmail}</p>
      </div>
      <div class="logo-container">
        <img src="${companyLogo}" class="logo" alt="Company Logo">
      </div>
    </div>

    <div class="invoice-body">
      <div class="invoice-meta">
        <div>
          <div class="invoice-number">الفاتورة رقم: ${invoiceNumber}</div>
          <div class="invoice-date">التاريخ: ${formattedDate}</div>
        </div>
        <div class="customer-info">
          <p>العميل: ${sale.customerName}</p>
          <p>رقم الجوال: ${sale.customerPhone || 'غير متوفر'}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${sale.products.map(product => `
            <tr>
              <td>${product.productName}</td>
              <td>${product.quantity}</td>
              <td>${product.price.toLocaleString()} جنيه</td>
              <td>${(product.quantity * product.price).toLocaleString()} جنيه</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-label">المجموع الكلي:</div>
        <div class="total-amount">${totalAmount.toLocaleString()} جنيه</div>
      </div>

      <div class="signature-section">
        <div class="signature">
          <span class="signature-text">${companyName}</span>
        </div>
      </div>

      <div class="footer">
        <p>شكرًا لتعاملكم مع ${companyName}</p>
        <p>للاستفسارات: ${companyPhone} | ${companyEmail}</p>
        <p>هذه الفاتورة صادرة إلكترونيًا ولا تحتاج إلى ختم</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

    const browser = await puppeteer.launch({
      headless: chromium.headless,
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, "--font-render-hinting=none"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: ["networkidle0", "domcontentloaded"]
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      preferCSSPageSize: true,
    });

    await browser.close();

    const invoicesDir = path.join(__dirname, "../invoices");
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    
    const filePath = path.join(invoicesDir, `invoice_${saleId}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);

    res.setHeader("Content-Disposition", `attachment; filename=invoice_${saleId}.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
    
  } catch (err) {
    console.error("❌ خطأ في إنشاء الفاتورة:", err);
    res.status(500).json({ message: "خطأ في إنشاء الفاتورة" });
  }
});

module.exports = router;