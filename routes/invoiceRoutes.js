const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const User = require('../models/User');

// دالة للحصول على إعدادات Chromium
async function getChromiumConfig() {
  return {
    executablePath: process.env.CHROMIUM_PATH || await chromium.executablePath(),
    headless: chromium.headless,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  };
}

// دالة لإنشاء محتوى HTML للفاتورة
function buildInvoiceHTML({ sale, company, invoiceNumber, date }) {
  const totalAmount = sale.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  
  return `
  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة ${invoiceNumber}</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { 
        font-family: 'Tajawal', sans-serif; 
        background: #f5f5f5;
        color: #333;
        line-height: 1.6;
      }
      .invoice-container {
        max-width: 800px;
        margin: 20px auto;
        padding: 20px;
        background: #fff;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid #eee;
      }
      .company-logo {
        width: 120px;
        height: auto;
      }
      .invoice-info {
        margin: 20px 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th, td {
        padding: 12px 15px;
        text-align: right;
        border-bottom: 1px solid #ddd;
      }
      th {
        background-color: #f9f9f9;
        font-weight: 700;
      }
      .total {
        font-size: 18px;
        font-weight: bold;
        margin-top: 20px;
        text-align: left;
      }
      .footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eee;
        text-align: center;
        font-size: 14px;
        color: #777;
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="header">
        <div>
          <h1>${company.name}</h1>
          <p>${company.address}</p>
          <p>${company.phone}</p>
        </div>
        <img src="${company.logo}" alt="شعار الشركة" class="company-logo">
      </div>

      <div class="invoice-info">
        <h2>فاتورة ضريبية</h2>
        <p><strong>رقم الفاتورة:</strong> ${invoiceNumber}</p>
        <p><strong>التاريخ:</strong> ${date}</p>
        <p><strong>العميل:</strong> ${sale.customerName || 'غير محدد'}</p>
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
              <td>${product.price.toFixed(2)} ج.م</td>
              <td>${(product.price * product.quantity).toFixed(2)} ج.م</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="total">
        الإجمالي: ${totalAmount.toFixed(2)} ج.م
      </div>

      <div class="footer">
        شكراً لتعاملكم معنا | للاستفسار ${company.phone}
      </div>
    </div>
  </body>
  </html>
  `;
}

router.get('/generateInvoice/:saleId', async (req, res) => {
  const { saleId } = req.params;
  let browser = null;

  try {
    // 1. التحقق من صحة المعرّف
    if (!saleId || !/^[0-9a-fA-F]{24}$/.test(saleId)) {
      return res.status(400).json({ 
        success: false,
        message: 'معرّف الفاتورة غير صالح'
      });
    }

    // 2. جلب البيانات من قاعدة البيانات
    const [sale, user] = await Promise.all([
      Sale.findById(saleId).lean(),
      User.findOne().lean().select('name address phone logo')
    ]);

    if (!sale) {
      return res.status(404).json({ 
        success: false,
        message: 'لم يتم العثور على الفاتورة'
      });
    }

    // 3. إنشاء محتوى HTML للفاتورة
    const htmlContent = buildInvoiceHTML({
      sale,
      company: {
        name: user?.name || 'شركة تجارية',
        address: user?.address || 'العنوان غير محدد',
        phone: user?.phone || '01xxxxxxxx',
        logo: user?.logo || 'https://via.placeholder.com/150'
      },
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    });

    // 4. الحصول على إعدادات Chromium
    const chromiumConfig = await getChromiumConfig();

    // 5. توليد ملف PDF
    browser = await puppeteer.launch(chromiumConfig);
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 60000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      timeout: 60000
    });

    // 6. التحقق من صحة الملف الناتج
    if (!pdfBuffer || pdfBuffer.length < 1024) {
      throw new Error('فشل إنشاء ملف PDF: الملف غير صالح');
    }

    // 7. إرسال الاستجابة النهائية
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice_${saleId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ فشل إنشاء الفاتورة:', error);
    const statusCode = error.message.includes('timeout') ? 504 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: 'فشل إنشاء الفاتورة',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  } finally {
    if (browser) {
      await browser.close().catch(err => {
        console.error('⚠️ خطأ في إغلاق المتصفح:', err);
      });
    }
  }
});

module.exports = router;