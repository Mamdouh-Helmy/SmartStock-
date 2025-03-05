const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const ClientSupplier = require('../models/ClientSupplier');
const authenticateToken = require('../middleware/authMiddleware');

router.post("/addSale", authenticateToken, async (req, res) => {
  try {
    const { products, customerName } = req.body;

    if (!products || !customerName || products.length === 0) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة ويجب أن تحتوي على منتجات' });
    }

    const year = new Date().getFullYear();
    const productsData = [];
    const bulkOperations = [];

    for (let product of products) {
      const { productName, quantity, price } = product;
      const inventoryItem = await Inventory.findOne({ productName });
      if (!inventoryItem || inventoryItem.quantity < quantity) {
        return res.status(400).json({ message: `الكمية غير كافية للمنتج: ${productName}` });
      }

      bulkOperations.push({
        updateOne: {
          filter: { productName },
          update: { $inc: { quantity: -quantity } }
        }
      });

      productsData.push({
        productName,
        quantity,
        price,
        totalAmount: quantity * price
      });
    }

    // تحديث المخزون وتنفيذ العمليات المجمعة
    await Inventory.bulkWrite(bulkOperations);
    // حذف المنتجات التي أصبحت كميتها 0
    await Inventory.deleteMany({ quantity: { $lte: 0 } });

    // إنشاء عملية البيع وحفظها
    const newSale = new Sale({ customerName, year, products: productsData });
    await newSale.save();

    // تحديث سجل العميل/المورد وإضافة سجل معاملة جديد مع التفاصيل
    const clientSupplier = await ClientSupplier.findOne({ name: customerName });
    if (clientSupplier) {
      const totalAmount = productsData.reduce((total, product) => total + product.totalAmount, 0);
      clientSupplier.balance += totalAmount; // تحديث الرصيد

      // إضافة سجل معاملة جديد مع تفاصيل البيع والوقت والتاريخ ورابط العملية (saleId)
      clientSupplier.transactions.push({
        type: "sale",
        amount: totalAmount,
        date: new Date(),
        details: productsData,
        saleId: newSale._id
      });

      await clientSupplier.save();
    }

    res.status(201).json({ message: 'تمت إضافة عملية البيع بنجاح وتم تحديث المخزون', sale: newSale });
  } catch (err) {
    console.error('حدث خطأ أثناء إضافة عملية البيع:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء إضافة عملية البيع' });
  }
});

// استرجاع جميع عمليات البيع
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sales = await Sale.find();
    res.status(200).json(sales);
  } catch (err) {
    console.error('حدث خطأ أثناء جلب عمليات البيع:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء جلب عمليات البيع' });
  }
});

// حذف عملية بيع
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'لم يتم العثور على عملية البيع' });
    }

    const bulkOperations = [];

    for (let product of sale.products) {
      const existingProduct = await Inventory.findOne({ productName: product.productName });
      if (existingProduct) {
        bulkOperations.push({
          updateOne: {
            filter: { productName: product.productName },
            update: {
              $inc: { 
                quantity: product.quantity, 
                totalValue: product.quantity * existingProduct.price
              }
            }
          }
        });
      } else {
        bulkOperations.push({
          insertOne: {
            document: {
              productName: product.productName,
              quantity: product.quantity,
              price: product.price,
              totalValue: product.quantity * product.price,
              year: sale.year
            }
          }
        });
      }
    }

    if (bulkOperations.length > 0) {
      await Inventory.bulkWrite(bulkOperations);
    }

    // تحديث سجل العميل/المورد: إعادة الرصيد وحذف سجل المعاملة المرتبط بعملية البيع
    const clientSupplier = await ClientSupplier.findOne({ name: sale.customerName });
    if (clientSupplier) {
      const totalAmount = sale.products.reduce((total, product) => total + product.totalAmount, 0);
      clientSupplier.balance -= totalAmount;
      // إزالة المعاملة التي لها saleId مطابق
      clientSupplier.transactions = clientSupplier.transactions.filter(
        tx => String(tx.saleId) !== String(sale._id)
      );
      await clientSupplier.save();
    }

    await Sale.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'تم حذف عملية البيع بنجاح وتم تعديل المخزون' });
  } catch (err) {
    console.error('حدث خطأ أثناء حذف عملية البيع:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء حذف عملية البيع' });
  }
});

// تعديل عملية بيع
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { products, customerName } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'لم يتم العثور على عملية البيع' });
    }

    // التحقق من توفر الكميات الجديدة قبل التحديث
    for (let newProduct of products) {
      const { productName, quantity } = newProduct;
      const inventoryItem = await Inventory.findOne({ productName });
      const oldProduct = sale.products.find(p => p.productName === productName);
      const oldQuantity = oldProduct ? oldProduct.quantity : 0;
      const availableQuantity = inventoryItem ? inventoryItem.quantity + oldQuantity : oldQuantity;
      if (availableQuantity < quantity) {
        return res.status(400).json({ message: `الكمية غير كافية للمنتج: ${productName}` });
      }
    }

    const bulkOperations = [];
    for (let newProduct of products) {
      const { productName, quantity, price } = newProduct;
      const oldProduct = sale.products.find(p => p.productName === productName);
      const oldQuantity = oldProduct ? oldProduct.quantity : 0;
      const quantityDifference = quantity - oldQuantity;
      const inventoryItem = await Inventory.findOne({ productName });

      if (!inventoryItem) {
        bulkOperations.push({
          updateOne: {
            filter: { productName },
            update: {
              $set: {
                quantity: oldQuantity - quantity,
                price: price,
                totalValue: (oldQuantity - quantity) * price,
                year: sale.year,
              },
            },
            upsert: true,
          },
        });
      } else {
        const newInventoryQuantity = inventoryItem.quantity - quantityDifference;
        if (newInventoryQuantity === 0) {
          bulkOperations.push({
            deleteOne: {
              filter: { productName },
            },
          });
        } else {
          bulkOperations.push({
            updateOne: {
              filter: { productName },
              update: { $inc: { quantity: -quantityDifference } },
            },
          });
        }
      }

      // حساب totalAmount وتحديثه في المنتج الجديد
      newProduct.totalAmount = quantity * price;
    }

    await Inventory.bulkWrite(bulkOperations);

    // تحديث بيانات عملية البيع
    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      { customerName, products },
      { new: true }
    );

    // تحديث سجل العميل/المورد: تعديل الرصيد وتحديث سجل المعاملة المرتبط بهذه العملية
    const clientSupplier = await ClientSupplier.findOne({ name: customerName });
    if (clientSupplier) {
      const oldTotalAmount = sale.products.reduce((total, product) => total + product.totalAmount, 0);
      const newTotalAmount = products.reduce((total, product) => total + product.totalAmount, 0);
      const difference = newTotalAmount - oldTotalAmount;
      clientSupplier.balance += difference;

      // البحث عن سجل المعاملة المرتبط بعملية البيع وتحديثه
      const txIndex = clientSupplier.transactions.findIndex(
        tx => String(tx.saleId) === String(sale._id)
      );
      if (txIndex !== -1) {
        clientSupplier.transactions[txIndex].amount = newTotalAmount;
        clientSupplier.transactions[txIndex].date = new Date();
        clientSupplier.transactions[txIndex].details = products;
      } else {
        clientSupplier.transactions.push({
          type: "sale",
          amount: newTotalAmount,
          date: new Date(),
          details: products,
          saleId: sale._id
        });
      }
      await clientSupplier.save();
    }

    res.status(200).json({ message: 'تم تعديل عملية البيع بنجاح', sale: updatedSale });
  } catch (err) {
    console.error('حدث خطأ أثناء تعديل عملية البيع:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل عملية البيع' });
  }
});


module.exports = router;
