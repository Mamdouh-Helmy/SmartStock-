const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const User = require('../models/User');

// endpoint لجلب بيانات الفاتورة
router.get('/getInvoiceData/:saleId', async (req, res) => {
  const { saleId } = req.params;

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

    // إرسال البيانات للفرونت إند
    res.json({
      success: true,
      data: {
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
      }
    });

  } catch (error) {
    console.error('❌ فشل جلب بيانات الفاتورة:', error);
    
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات الفاتورة',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

module.exports = router;