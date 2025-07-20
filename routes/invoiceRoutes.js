// routes/invoiceRoutes.js
const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const Sale = require("../models/Sale");
const User = require("../models/User");

const router = express.Router();

router.get("/generateInvoice/:saleId", async (req, res) => {
  const saleId = req.params.saleId;

  try {
    // 1. جلب بيانات العملية
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }

    // 2. جلب بيانات المستخدم (بيانات الشركة)
    const user = await User.findOne();
    const companyName   = user?.name    || "اسم الشركة";
    const companyAddress= user?.address || "عنوان الشركة";
    const companyPhone  = user?.phone   || "هاتف الشركة";
    const companyLogo   = user?.logo    ||
      "https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg";

    // 3. تاريخ ووقت القاهرة
    const now = new Date();
    const opts = { timeZone: "Africa/Cairo", hour12: false };
    const formattedDate = now.toLocaleDateString("ar-EG", opts);
    const formattedTime = now.toLocaleTimeString("ar-EG", opts);

    // 4. رقم فاتورة عشوائي
    const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;

    // 5. حساب الإجمالي
    const totalAmount = sale.products.reduce(
      (sum, p) => sum + p.quantity * p.price,
      0
    );

    // 6. ضبط لغة التوقيع
    const isArabic = /[\u0600-\u06FF]/.test(companyName);

    // 7. بناء الـ HTML
    const htmlContent = `
      <html lang="ar">
        <head>
          <meta charset="UTF-8"/>
          <title>فاتورة مبيعات</title>
          <link href="https://fonts.googleapis.com/css2?family=Amiri&display=swap" rel="stylesheet"/>
          <link href="https://fonts.googleapis.com/css2?family=Satisfy&display=swap" rel="stylesheet"/>
          <style>
            body { background:#f2f2f2; font-family:'Amiri'; direction:rtl; margin:0; padding:20px }
            .invoice-container { max-width:800px; margin:auto; background:#fff; border-radius:8px; overflow:hidden;
              box-shadow:0 0 10px rgba(0,0,0,0.1); }
            .header { background:linear-gradient(135deg,#2c3e50,#34495e); color:#ecf0f1;
              display:flex; justify-content:space-between; align-items:center; padding:20px; }
            .company-info p { margin:5px 0; font-size:18px }
            .logo { width:120px; height:120px; border-radius:50%; border:2px solid #fff; object-fit:cover }
            .invoice-body { padding:20px }
            .invoice-details p { margin:8px 0; font-size:16px }
            .table { width:100%; border-collapse:collapse; margin-top:20px }
            .table th, .table td { border:1px solid #ddd; padding:12px; text-align:center }
            .table th { background:#ecf0f1 }
            .total { text-align:right; font-size:20px; margin-top:20px; font-weight:bold }
            .signature { margin-top:20px; text-align:center }
            .sig-text[lang="ar"], .sig-text[lang="en"] {
              font-size:48px; background:linear-gradient(45deg,#2c3e50,#ff0099);
              -webkit-background-clip:text; -webkit-text-fill-color:transparent;
              transform:rotate(-3deg); text-shadow:2px 2px 4px rgba(0,0,0,0.3);
            }
            .sig-text[lang="en"] { font-family:'Satisfy', cursive }
            .signature p { margin-top:10px; font-size:16px; color:#333 }
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
              <img src="${companyLogo}" class="logo" />
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
                  <tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
                </thead>
                <tbody>
                  ${sale.products.map(p => `
                    <tr>
                      <td>${p.productName}</td>
                      <td>${p.quantity}</td>
                      <td>${p.price} جنيه</td>
                      <td>${p.quantity * p.price} جنيه</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
              <div class="total">المجموع: ${totalAmount} جنيه</div>
              <div class="signature">
                <p><strong>التوقيع:</strong></p>
                <span class="sig-text" lang="${isArabic ? "ar" : "en"}">${companyName}</span>
                <p>شكراً لتعاملكم معنا</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // 8. Launch Puppeteer و توليد PDF
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();

    // انتظر حتى تُحمّل كل الموارد (fonts, CSS, images)
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await browser.close();

    // 9. إرسال الملف مباشرة مع الهيدرّات المناسبة
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${saleId}.pdf`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Encoding", "identity");
    return res.status(200).send(pdfBuffer);

  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    return res.status(500).json({ message: "خطأ في إنشاء الفاتورة" });
  }
});

module.exports = router;
