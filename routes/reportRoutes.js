// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const authenticateToken = require('../middleware/authMiddleware');

// تقرير عن أكثر الأصناف مبيعًا
// تقرير عن أكثر الأصناف مبيعًا بناءً على الكمية
router.get('/topSellingByQuantity/:year', authenticateToken, async (req, res) => {
  const { year } = req.params;
  try {
    const topSelling = await Sale.aggregate([
      { $match: { year: Number(year) } }, // تصفية حسب السنة
      { $unwind: '$products' },
      { $group: { _id: '$products.productName', totalQuantity: { $sum: '$products.quantity' } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);
    res.json(topSelling);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب التقارير' });
  }
});//


// تقرير عن أقل الأصناف مبيعًا بناءً على الكمية
router.get('/bottomSellingByQuantity/:year', authenticateToken, async (req, res) => {
  const { year } = req.params;
  try {
    const bottomSelling = await Sale.aggregate([
      { $match: { year: Number(year) } }, // تصفية حسب السنة
      { $unwind: '$products' },
      { $group: { _id: '$products.productName', totalQuantity: { $sum: '$products.quantity' } } },
      { $sort: { totalQuantity: 1 } },
      { $limit: 10 },
    ]);
    res.json(bottomSelling);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب التقارير' });
  }
});/////

// تقرير عن المبيعات لسنة معينة
router.get('/salesByYear/:year',authenticateToken, async (req, res) => {
  const { year } = req.params;

  try {
    const sales = await Sale.find({ year });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب البيانات' });
  }
});

// إيرادات كل منتج
router.get('/totalRevenueByProduct/:year', authenticateToken, async (req, res) => {
  const { year } = req.params;
  try {
    const revenueByProduct = await Sale.aggregate([
      { $match: { year: Number(year) } }, // تصفية حسب السنة
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.productName',
          totalRevenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);
    res.json(revenueByProduct);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب التقارير' });
  }
});//////

// المبيعات الشهرية لعام معين
router.get('/monthlySales/:year',authenticateToken, async (req, res) => {
  const { year } = req.params;
  try {
    const monthlySales = await Sale.aggregate([
      { 
        $match: { 
          saleDate: { 
            $gte: new Date(`${year}-01-01`), 
            $lte: new Date(`${year}-12-31`) 
          } 
        } 
      },
      { $unwind: "$products" },
      { 
        $group: { 
          _id: { $month: "$saleDate" }, 
          totalSales: { $sum: { $multiply: ["$products.quantity", "$products.price"] } }
        } 
      },
      { $sort: { "_id": 1 } }
    ]);
    res.json(monthlySales);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب البيانات' });
  }
});

router.get('/availableStock/:year', authenticateToken, async (req, res) => {
  const { year } = req.params;
  console.log("Fetching available stock for year:", year); // تأكد من أن القيمة تصل
  try {
    const availableStock = await Inventory.find({ year: Number(year) });
    res.status(200).json(availableStock || []);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب بيانات المخزون' });
  }
});

router.get('/lowStockItems/:year', authenticateToken, async (req, res) => {
  const { year } = req.params;
  try {
    const lowStockItems = await Inventory.find({ year: Number(year), quantity: { $lt: 10 } });
    res.status(200).json(lowStockItems || []);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب بيانات المخزون' });
  }
});

// نسبة الإيرادات لكل منتج
router.get('/revenuePercentageByProduct/:year', authenticateToken, async (req, res) => {
  const { year } = req.params;
  try {
    const result = await Sale.aggregate([
      { $match: { year: Number(year) } }, // تصفية حسب السنة
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.productName',
          revenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          products: { $push: { name: '$_id', revenue: '$revenue' } },
        },
      },
      { $unwind: '$products' },
      {
        $project: {
          _id: 0,
          productName: '$products.name',
          revenue: '$products.revenue',
          percentage: { $multiply: [{ $divide: ['$products.revenue', '$totalRevenue'] }, 100] },
        },
      },
      { $sort: { percentage: -1 } },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب التقارير' });
  }
});/////


module.exports = router;
