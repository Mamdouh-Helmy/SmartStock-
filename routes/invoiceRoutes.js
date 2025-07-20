const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const User = require("../models/User");

// إعدادات Chromium الإضافية
chromium.setGraphicsMode = false;

router.get("/generateInvoice/:saleId", async (req, res) => {
  const saleId = req.params.saleId;
  let browser = null;
  
  try {
    // 1. جلب بيانات البيع والمستخدم
    const [sale, user] = await Promise.all([
      Sale.findById(saleId),
      User.findOne()
    ]);

    if (!sale) {
      return res.status(404).json({ message: "البيع غير موجود" });
    }

    // 2. تحضير بيانات الفاتورة
    const companyInfo = {
      name: user?.name || "شركة غير محددة",
      address: user?.address || "عنوان غير محدد",
      phone: user?.phone || "هاتف غير محدد",
      logo: user?.logo || "https://via.placeholder.com/150"
    };

    const now = new Date();
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${saleId.slice(-6)}`;
    const totalAmount = sale.products.reduce((sum, product) => sum + (product.price * product.quantity), 0);

    // 3. إنشاء محتوى HTML
    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة ${invoiceNumber}</title>
      <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #333; }
        .invoice-container { max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #ddd; }
        .header { display: flex; justify-content: space-between; padding: 20px; background: #f5f5f5; }
        .logo { width: 120px; height: auto; }
        .invoice-details { padding: 20px; border-bottom: 1px solid #eee; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; text-align: left; padding: 20px; font-size: 18px; }
        .footer { padding: 20px; text-align: center; font-size: 14px; color: #777; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div>
            <h1>${companyInfo.name}</h1>
            <p>${companyInfo.address}</p>
            <p>${companyInfo.phone}</p>
          </div>
          <img src="${companyInfo.logo}" class="logo" alt="شعار الشركة">
        </div>
        
        <div class="invoice-details">
          <h2>فاتورة #${invoiceNumber}</h2>
          <p>التاريخ: ${now.toLocaleDateString('ar-EG')}</p>
          <p>العميل: ${sale.customerName || "عميل غير معروف"}</p>
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
                <td>${product.price.toFixed(2)}</td>
                <td>${(product.price * product.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total">
          المبلغ الإجمالي: ${totalAmount.toFixed(2)} جنيه
        </div>
        
        <div class="footer">
          شكراً لتعاملكم معنا | للاستفسار ${companyInfo.phone}
        </div>
      </div>
    </body>
    </html>
    `;

    // 4. إنشاء PDF باستخدام Puppeteer
    console.log("🚀 جاري تهيئة المتصفح...");
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      headless: "new",
      timeout: 60000
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 30000
    });

    console.log("📄 جاري إنشاء PDF...");
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      timeout: 30000
    });

    if (!pdfBuffer || pdfBuffer.length < 1024) {
      throw new Error("فشل إنشاء ملف PDF - الملف صغير جداً أو فارغ");
    }

    console.log(`✅ تم إنشاء PDF بنجاح! (حجم الملف: ${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    // 5. إرسال الاستجابة
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice_${invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    
    return res.send(pdfBuffer);

  } catch (error) {
    console.error("❌ خطأ في إنشاء الفاتورة:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إنشاء الفاتورة",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.error("⚠️ خطأ أثناء إغلاق المتصفح:", err);
      }
    }
  }
});

module.exports = router;