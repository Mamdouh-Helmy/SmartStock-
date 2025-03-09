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
    
    // تنسيق التاريخ والوقت
    const saleDate = new Date(sale.saleDate);
    const formattedDate = `${saleDate.getDate()}/${saleDate.getMonth() + 1}/${saleDate.getFullYear()}`;
    const formattedTime = `${saleDate.getHours()}:${saleDate.getMinutes()}:${saleDate.getSeconds()}`;
    
    // توليد رقم الفاتورة وحساب الإجمالي العام
    const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = sale.products.reduce(
      (acc, product) => acc + product.quantity * product.price,
      0
    );
    
    // التحقق مما إذا كان الاسم يحتوي على حروف عربية
    const isArabic = /[\u0600-\u06FF]/.test(companyName);
    
    // كود HTML للفاتورة بتصميم مطور
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
        background: #f0f0f0;
        font-family: 'Amiri', serif;
        direction: rtl;
        text-align: right;
        margin: 0;
        padding: 0;
      }
      .invoice-container {
        width: 90%;
        max-width: 800px;
        margin: 40px auto;
        background: #fff;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 6px 12px rgba(0,0,0,0.15);
      }
      .invoice-header {
        background: linear-gradient(135deg, #800000, #DAA520);
        color: #fff;
        padding: 25px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .invoice-header .company-info {
        font-size: 20px;
      }
      .invoice-header .company-info p {
        margin: 4px 0;
      }
      .invoice-header .logo {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        border: 3px solid #fff;
      }
      .invoice-body {
        padding: 30px;
      }
      .invoice-details {
        margin-bottom: 25px;
        font-size: 18px;
        line-height: 1.8;
      }
      .invoice-details p {
        margin: 6px 0;
      }
      .products-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 25px;
      }
      .products-table th,
      .products-table td {
        border: 1px solid #ddd;
        padding: 12px;
        font-size: 16px;
        text-align: center;
      }
      .products-table th {
        background: #f8f8f8;
      }
      .products-table tr:nth-child(even) {
        background: #fbfbfb;
      }
      .total-amount {
        text-align: right;
        font-size: 22px;
        font-weight: bold;
        padding: 15px;
        background: #f8f8f8;
        border-top: 2px solid #ddd;
      }
      .signature {
        margin-top: 30px;
        text-align: center;
      }
      .signature .sig-text {
        font-size: 42px;
        background: linear-gradient(45deg, #800000, #DAA520);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        transform: rotate(-3deg);
        text-shadow: 2px 2px 5px rgba(0,0,0,0.3);
      }
      .signature p {
        margin-top: 12px;
        font-size: 18px;
        color: #555;
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="invoice-header">
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
        <table class="products-table">
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
        <div class="total-amount">
          <p>المجموع: ${totalAmount} جنيه</p>
        </div>
        <div class="signature">
          <p><strong>التوقيع:</strong></p>
          <span class="sig-text" lang="${isArabic ? 'ar' : 'en'}">${companyName}</span>
          <p>شكراً لتعاملكم معنا</p>
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
      args: chromium.args
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });
    console.log("📄 إنشاء ملف PDF...");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" }
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
