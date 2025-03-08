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
    if (!sale) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }

    // ✅ 1️⃣ جلب بيانات المستخدم (صاحب المتجر)
    const owner = await User.findOne(); // جلب أول مستخدم مسجل (يمكن تعديله لاحقًا)
    if (!owner) {
      return res.status(500).json({ message: "لم يتم العثور على بيانات المتجر" });
    }

    // ✅ 2️⃣ توليد رقم فاتورة بصيغة M1, M2, M3 ...
    const invoiceNumber = `M${saleId.slice(-5)}`;

    // ✅ 3️⃣ تنسيق التاريخ والوقت
    const saleDate = new Date(sale.saleDate);
    const formattedDate = `${saleDate.getDate()}/${saleDate.getMonth() + 1}/${saleDate.getFullYear()}`;
    const formattedTime = `${saleDate.getHours()}:${saleDate.getMinutes()}:${saleDate.getSeconds()}`;

    // ✅ 4️⃣ إنشاء محتوى HTML للفاتورة مع اللوجو والختم والتوقيع
    const htmlContent = `
  <html lang="ar">
    <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Amiri', serif; direction: rtl; text-align: right; font-size: 18px; padding: 20px; }
        .container { width: 100%; max-width: 800px; margin: auto; border: 2px solid #000; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; }
        .logo { max-width: 100px; }
        .invoice-title { font-size: 28px; font-weight: bold; margin-top: 10px; }
        .store-info { margin-top: 10px; font-size: 16px; }
        .invoice-details { margin-top: 20px; padding: 10px; border: 2px dashed #000; font-size: 16px; }
        .invoice-details p { margin: 5px 0; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { border: 1px solid #000; padding: 10px; text-align: right; font-size: 16px; }
        .total { font-size: 20px; font-weight: bold; text-align: left; margin-top: 20px; }
        .signature { margin-top: 40px; text-align: left; font-size: 18px; }
        .signature img { max-width: 150px; }
        .stamp { text-align: left; margin-top: 20px; }
        .stamp img { max-width: 100px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${owner.logo}" class="logo" alt="شعار المتجر" />
          <div class="invoice-title">🧾 فاتورة بيع</div>
          <div class="store-info">
            <p><strong>${owner.name}</strong></p>
            <p>${owner.address}</p>
            <p>📞 ${owner.phone}</p>
          </div>
        </div>

        <div class="invoice-details">
          <p><strong>📌 رقم الفاتورة:</strong> ${invoiceNumber}</p>
          <p><strong>📅 التاريخ:</strong> ${formattedDate}</p>
          <p><strong>⏰ الوقت:</strong> ${formattedTime}</p>
          <p><strong>👤 اسم العميل:</strong> ${sale.customerName}</p>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>📦 المنتج</th>
              <th>🔢 الكمية</th>
              <th>💰 السعر</th>
              <th>💲 الإجمالي</th>
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
          <p><strong>💵 الإجمالي الكلي: ${sale.products.reduce((sum, product) => sum + product.quantity * product.price, 0)} جنيه</strong></p>
        </div>

        <div class="signature">
          <p><strong>📌 التوقيع:</strong></p>
          <img src="https://via.placeholder.com/150?text=التوقيع" alt="التوقيع" />
        </div>

        <div class="stamp">
          <p><strong>🔴 الختم:</strong></p>
          <img src="https://via.placeholder.com/100?text=ختم+ممدوح" alt="الختم" />
        </div>
      </div>
    </body>
  </html>
`;

    // تشغيل Puppeteer وإنشاء PDF
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

    res.setHeader("Content-Disposition", `attachment; filename=invoice_${saleId}.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    res.status(500).json({ message: "خطأ في إنشاء الفاتورة" });
  }
});

module.exports = router;
