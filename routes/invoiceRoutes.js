const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Sale = require('../models/Sale');
const User = require('../models/User');

// دالة لإنشاء الفاتورة
async function generateInvoice(sale, user, res) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30,
        layout: 'portrait',
        info: {
          Title: `فاتورة ${sale._id}`,
          Author: user?.name || 'System'
        }
      });

      // إعداد الخطوط (يجب توفير ملفات الخطوط مسبقاً)
      const fontsDir = path.join(__dirname, '../public/fonts');
      doc.registerFont('ArabicBold', path.join(fontsDir, 'Tajawal-Bold.ttf'));
      doc.registerFont('ArabicRegular', path.join(fontsDir, 'Tajawal-Regular.ttf'));

      // إنشاء مسار مؤقت لحفظ الملف
      const invoicesDir = path.join(__dirname, '../temp/invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const filePath = path.join(invoicesDir, `invoice_${sale._id}.pdf`);
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // رأس الفاتورة
      doc.font('ArabicBold').fontSize(18).text('فاتورة ضريبية', {
        align: 'right',
        underline: true
      });
      doc.moveDown(0.5);

      // معلومات الشركة
      doc.font('ArabicBold').fontSize(14).text(user?.name || 'شركة تجارية', { align: 'right' });
      doc.font('ArabicRegular').fontSize(12)
        .text(user?.address || 'العنوان: غير محدد', { align: 'right' })
        .text(user?.phone || 'الهاتف: 01xxxxxxxx', { align: 'right' });
      doc.moveDown(1);

      // معلومات الفاتورة
      const invoiceNumber = `INV-${sale._id.toString().slice(-8)}`;
      const invoiceDate = new Date(sale.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.font('ArabicRegular').fontSize(12)
        .text(`رقم الفاتورة: ${invoiceNumber}`, { align: 'right' })
        .text(`التاريخ: ${invoiceDate}`, { align: 'right' })
        .text(`العميل: ${sale.customerName || 'غير محدد'}`, { align: 'right' });
      doc.moveDown(1.5);

      // جدول المنتجات
      const startY = doc.y;
      const tableTop = startY + 10;

      // رأس الجدول
      doc.font('ArabicBold').fontSize(12)
        .text('المنتج', 400, tableTop, { align: 'right' })
        .text('الكمية', 300, tableTop)
        .text('السعر', 200, tableTop)
        .text('الإجمالي', 100, tableTop);

      // محتوى الجدول
      let currentY = tableTop + 20;
      let total = 0;

      sale.products.forEach((product, index) => {
        const productTotal = product.price * product.quantity;
        total += productTotal;

        doc.font('ArabicRegular').fontSize(10)
          .text(product.productName || 'غير محدد', 400, currentY, { align: 'right' })
          .text(product.quantity.toString(), 300, currentY)
          .text(`${product.price.toFixed(2)} ج.م`, 200, currentY)
          .text(`${productTotal.toFixed(2)} ج.م`, 100, currentY);

        currentY += 20;
        if (index < sale.products.length - 1) {
          doc.moveTo(50, currentY - 5).lineTo(550, currentY - 5).stroke();
        }
      });

      // الإجمالي
      doc.moveTo(50, currentY + 10).lineTo(550, currentY + 10).stroke();
      doc.font('ArabicBold').fontSize(14)
        .text(`الإجمالي: ${total.toFixed(2)} ج.م`, 100, currentY + 20, { align: 'left' });

      // تذييل الفاتورة
      doc.font('ArabicRegular').fontSize(10)
        .text('شكراً لتعاملكم معنا', { align: 'center' }, currentY + 50)
        .text(`للاستفسار: ${user?.phone || '01xxxxxxxx'}`, { align: 'center' });

      // إنهاء المستند
      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
}

// مسار إنشاء الفاتورة
router.get('/generateInvoice/:saleId', async (req, res) => {
  try {
    const { saleId } = req.params;

    // التحقق من صحة المعرّف
    if (!saleId || !/^[0-9a-fA-F]{24}$/.test(saleId)) {
      return res.status(400).json({
        success: false,
        message: 'معرّف الفاتورة غير صالح'
      });
    }

    // جلب البيانات
    const [sale, user] = await Promise.all([
      Sale.findById(saleId).lean(),
      User.findOne().lean().select('name address phone logo.')
    ]);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على الفاتورة'
      });
    }

    // إنشاء الفاتورة
    const filePath = await generateInvoice(sale, user, res);

    // إرسال الملف
    res.download(filePath, `invoice_${saleId}.pdf`, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // حذف الملف المؤقت بعد الإرسال
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
    });

  } catch (error) {
    console.error('❌ فشل إنشاء الفاتورة:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الفاتورة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;