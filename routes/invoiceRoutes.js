
const html2pdf = require("html2pdf.js");
const { JSDOM } = require("jsdom");
const fs = require("fs").promises;
const path = require("path");
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
    // جلب بيانات المستخدم
    const user = await User.findOne();
    const companyName = user?.name || "اسم الشركة";
    const companyAddress = user?.address || "عنوان الشركة";
    const companyPhone = user?.phone || "هاتف الشركة";
    const companyLogo =
      user?.logo ||
      "https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg";

    // الوقت والتاريخ
    const now = new Date();
    const options = { timeZone: "Africa/Cairo", hour12: false };
    const formattedDate = now.toLocaleDateString("ar-EG", options);
    const formattedTime = now.toLocaleTimeString("ar-EG", options);
    const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = sale.products.reduce(
      (acc, product) => acc + product.quantity * product.price,
      0
    );

    // التحقق مما إذا كان الاسم يحتوي على حروف عربية
    const isArabic = /[\u0600-\u06FF]/.test(companyName);

    // قراءة نص Base64 للخط
    const amiriBase64 = await fs.readFile(
      path.join(__dirname, "amiri-base64.txt"),
      "utf8"
    );

    // كود HTML للفاتورة
    const htmlContent = `
<html lang="ar">
  <head>
    <meta charset="UTF-8" />
    <title>فاتورة المبيعات</title>
    <style>
      @font-face {
        font-family: 'Amiri';
        src: url(data:font/ttf;base64,${amiriBase64}) format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      @font-face {
        font-family: 'Satisfy';
        src: url('https://github.com/itfoundry/satisfy/raw/master/Satisfy-Regular.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
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
      .signature .sig-text[lang="ar"],
      .signature .sig-text[lang="en"] {
        font-size: 48px;
        background: linear-gradient(45deg, #2c3e50, #ff0099);
        -webkit-background-clip: text;
        color: transparent;
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
          <span class="sig-text" lang="${isArabic ? "ar" : "en"}">${companyName}</span>
          <p>شكرًا لتعاملكم معنا</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

    // إنشاء بيئة DOM وهمية باستخدام jsdom
    const { window } = new JSDOM(htmlContent);
    const { document } = window;

    // إنشاء ملف PDF باستخدام html2pdf.js
    const pdfBuffer = await html2pdf()
      .from(document.body)
      .set({
        margin: 0,
        filename: `invoice_${saleId}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .output("arraybuffer");

    // حفظ الملف مؤقتًا
    const invoicesDir = "/tmp/invoices";
    await fs.mkdir(invoicesDir, { recursive: true });
    const filePath = path.join(invoicesDir, `invoice_${saleId}.pdf`);
    await fs.writeFile(filePath, Buffer.from(pdfBuffer));

    // إرسال الملف للمستخدم
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${saleId}.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath, async (err) => {
      if (err) {
        console.error("❌ خطأ أثناء إرسال الملف:", err);
        res.status(500).json({ message: "خطأ في إرسال الفاتورة" });
      }
      try {
        await fs.unlink(filePath);
        console.log("🗑️ تم حذف ملف الفاتورة بنجاح");
      } catch (unlinkErr) {
        console.error("❌ خطأ أثناء حذف الملف:", unlinkErr);
      }
    });
  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    res.status(500).json({ message: "خطأ في إنشاء الفاتورة", error: err.message });
  }
});

module.exports = router;
