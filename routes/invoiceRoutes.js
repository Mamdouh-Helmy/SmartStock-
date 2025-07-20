const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const User = require('../models/User');

// إعدادات Chromium محسنة لـ Vercel
async function getChromiumConfig() {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    return {
      executablePath: '/usr/bin/google-chrome-stable',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };
  }

  return {
    executablePath: await chromium.executablePath(),
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
      '--disable-gpu',
      '--disable-web-security',
      '--font-render-hinting=none'
    ]
  };
}

// دالة إنشاء HTML محسنة للعربية
function buildInvoiceHTML({ sale, company, invoiceNumber, date }) {
  const totalAmount = sale.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const vatAmount = totalAmount * 0.15; // ضريبة القيمة المضافة 15%
  const totalWithVat = totalAmount + vatAmount;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة ${invoiceNumber}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            color: #1e293b;
            line-height: 1.7;
            font-weight: 400;
            direction: rtl;
            text-align: right;
        }

        .invoice-container {
            max-width: 800px;
            margin: 30px auto;
            padding: 0;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }

        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 40px;
            text-align: center;
            position: relative;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="25" cy="75" r="1" fill="white" opacity="0.05"/><circle cx="75" cy="25" r="1" fill="white" opacity="0.05"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.3;
        }

        .header-content {
            position: relative;
            z-index: 1;
        }

        .company-name {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }

        .company-info {
            font-size: 16px;
            font-weight: 400;
            opacity: 0.9;
            line-height: 1.6;
        }

        .invoice-title {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 30px 40px;
            border-bottom: 3px solid #e2e8f0;
        }

        .invoice-title h2 {
            font-size: 28px;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 20px;
            text-align: center;
        }

        .invoice-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 20px;
        }

        .detail-group {
            background: white;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .detail-group h3 {
            font-size: 18px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f3f4f6;
        }

        .detail-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 15px;
        }

        .detail-label {
            font-weight: 500;
            color: #6b7280;
        }

        .detail-value {
            font-weight: 600;
            color: #1f2937;
        }

        .content {
            padding: 40px;
        }

        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .products-table thead {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        }

        .products-table th {
            padding: 20px 15px;
            text-align: center;
            font-weight: 600;
            font-size: 16px;
            color: #374151;
            border-bottom: 2px solid #d1d5db;
        }

        .products-table td {
            padding: 18px 15px;
            text-align: center;
            border-bottom: 1px solid #f3f4f6;
            font-size: 15px;
            font-weight: 500;
        }

        .products-table tbody tr:hover {
            background-color: #f9fafb;
        }

        .products-table tbody tr:last-child td {
            border-bottom: none;
        }

        .product-name {
            font-weight: 600;
            color: #1f2937;
        }

        .quantity {
            background: #dbeafe;
            color: #1e40af;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            display: inline-block;
        }

        .price {
            font-weight: 600;
            color: #059669;
        }

        .total-section {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 30px;
            border-radius: 12px;
            margin-top: 30px;
            border: 1px solid #e2e8f0;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            font-size: 16px;
        }

        .total-row:last-child {
            margin-bottom: 0;
            padding-top: 15px;
            border-top: 2px solid #d1d5db;
            font-size: 20px;
            font-weight: 700;
            color: #1e40af;
        }

        .total-label {
            font-weight: 500;
            color: #6b7280;
        }

        .total-value {
            font-weight: 600;
            color: #1f2937;
        }

        .final-total {
            color: #1e40af !important;
        }

        .footer {
            background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
            color: white;
            padding: 30px 40px;
            text-align: center;
            margin-top: 40px;
        }

        .footer-content {
            font-size: 16px;
            line-height: 1.8;
        }

        .footer-highlight {
            font-weight: 600;
            color: #60a5fa;
        }

        .currency {
            font-weight: 600;
            color: #059669;
        }

        @media print {
            body {
                background: white;
            }
            
            .invoice-container {
                box-shadow: none;
                border: none;
                margin: 0;
                border-radius: 0;
            }
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            color: rgba(0, 0, 0, 0.05);
            font-weight: 700;
            z-index: -1;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="watermark">فاتورة</div>
    
    <div class="invoice-container">
        <div class="header">
            <div class="header-content">
                <h1 class="company-name">${company.name}</h1>
                <div class="company-info">
                    <div>${company.address}</div>
                    <div>الهاتف: ${company.phone}</div>
                    ${company.email ? `<div>البريد الإلكتروني: ${company.email}</div>` : ''}
                    ${company.taxNumber ? `<div>الرقم الضريبي: ${company.taxNumber}</div>` : ''}
                </div>
            </div>
        </div>

        <div class="invoice-title">
            <h2>🧾 فاتورة ضريبية</h2>
            <div class="invoice-details">
                <div class="detail-group">
                    <h3>📋 تفاصيل الفاتورة</h3>
                    <div class="detail-item">
                        <span class="detail-label">رقم الفاتورة:</span>
                        <span class="detail-value">${invoiceNumber}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">التاريخ:</span>
                        <span class="detail-value">${date}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">الوقت:</span>
                        <span class="detail-value">${new Date().toLocaleTimeString('ar-EG', { hour12: true })}</span>
                    </div>
                </div>
                <div class="detail-group">
                    <h3>👤 بيانات العميل</h3>
                    <div class="detail-item">
                        <span class="detail-label">اسم العميل:</span>
                        <span class="detail-value">${sale.customerName || 'عميل عام'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">نوع العملية:</span>
                        <span class="detail-value">مبيعات نقدية</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="content">
            <table class="products-table">
                <thead>
                    <tr>
                        <th style="width: 10%;">#</th>
                        <th style="width: 40%;">اسم المنتج</th>
                        <th style="width: 15%;">الكمية</th>
                        <th style="width: 17.5%;">السعر</th>
                        <th style="width: 17.5%;">الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${sale.products.map((product, index) => `
                        <tr>
                            <td style="font-weight: 600; color: #6b7280;">${index + 1}</td>
                            <td class="product-name">${product.productName}</td>
                            <td><span class="quantity">${product.quantity}</span></td>
                            <td class="price">${parseFloat(product.price).toFixed(2)} <span class="currency">ج.م</span></td>
                            <td class="price">${(parseFloat(product.price) * parseInt(product.quantity)).toFixed(2)} <span class="currency">ج.م</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="total-section">
                <div class="total-row">
                    <span class="total-label">المجموع الفرعي:</span>
                    <span class="total-value">${totalAmount.toFixed(2)} <span class="currency">ج.م</span></span>
                </div>
                <div class="total-row">
                    <span class="total-label">ضريبة القيمة المضافة (15%):</span>
                    <span class="total-value">${vatAmount.toFixed(2)} <span class="currency">ج.م</span></span>
                </div>
                <div class="total-row">
                    <span class="total-label">🧮 الإجمالي النهائي:</span>
                    <span class="total-value final-total">${totalWithVat.toFixed(2)} <span class="currency">ج.م</span></span>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="footer-content">
                <div style="margin-bottom: 10px;">
                    شكراً لتعاملكم معنا 🙏
                </div>
                <div>
                    للاستفسار اتصل على: <span class="footer-highlight">${company.phone}</span>
                </div>
                ${company.website ? `<div>الموقع الإلكتروني: <span class="footer-highlight">${company.website}</span></div>` : ''}
            </div>
        </div>
    </div>
</body>
</html>`;
}

// تحسين endpoint إنشاء الفاتورة
router.get('/generateInvoice/:saleId', async (req, res) => {
  const { saleId } = req.params;
  let browser = null;

  try {
    // التحقق من صحة المعرّف
    if (!saleId || !/^[0-9a-fA-F]{24}$/.test(saleId)) {
      return res.status(400).json({
        success: false,
        message: 'معرّف الفاتورة غير صالح'
      });
    }

    // جلب البيانات من قاعدة البيانات
    const [sale, user] = await Promise.all([
      Sale.findById(saleId).lean(),
      User.findOne().lean().select('name address phone email taxNumber website logo')
    ]);

    if (!sale) {
      return res.status(404).json({ 
        success: false,
        message: 'لم يتم العثور على الفاتورة المطلوبة'
      });
    }

    // إنشاء محتوى HTML للفاتورة
    const htmlContent = buildInvoiceHTML({
      sale,
      company: {
        name: user?.name || 'شركة تجارية',
        address: user?.address || 'العنوان غير محدد',
        phone: user?.phone || '01xxxxxxxx',
        email: user?.email || '',
        taxNumber: user?.taxNumber || '',
        website: user?.website || '',
        logo: user?.logo || ''
      },
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('ar-EG', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    });

    // الحصول على إعدادات Chromium
    const chromiumConfig = await getChromiumConfig();

    // إطلاق المتصفح وإنشاء الصفحة
    browser = await puppeteer.launch(chromiumConfig);
    const page = await browser.newPage();

    // تعيين إعدادات الصفحة
    await page.setViewport({ width: 1200, height: 800 });
    
    // تحميل المحتوى
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 30000
    });

    // إنشاء ملف PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { 
        top: '15mm', 
        right: '15mm', 
        bottom: '15mm', 
        left: '15mm' 
      },
      preferCSSPageSize: true,
      timeout: 30000
    });

    // التحقق من صحة الملف
    if (!pdfBuffer || pdfBuffer.length < 1024) {
      throw new Error('فشل إنشاء ملف PDF: الملف غير صالح');
    }

    // إعداد headers الاستجابة
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${saleId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // إرسال الملف
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ فشل إنشاء الفاتورة:', error);
    
    const statusCode = error.message.includes('timeout') ? 504 : 
                      error.message.includes('not found') ? 404 : 500;
    
    const errorMessage = error.message.includes('timeout') ? 
                        'انتهت مهلة إنشاء الفاتورة، يرجى المحاولة مرة أخرى' :
                        'فشل في إنشاء الفاتورة، يرجى المحاولة لاحقاً';

    if (!res.headersSent) {
      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('⚠️ خطأ في إغلاق المتصفح:', closeError);
      }
    }
  }
});

module.exports = router;