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

      productsData.push({ productName, quantity, price, totalAmount: quantity * price });
    }

    await Inventory.bulkWrite(bulkOperations);

    // حذف المنتجات التي أصبحت كميتها 0
    await Inventory.deleteMany({ quantity: { $lte: 0 } });

    const newSale = new Sale({ customerName, year, products: productsData });
    await newSale.save();

    // تحديث رصيد العميل أو المورد
    const clientSupplier = await ClientSupplier.findOne({ name: customerName });
    if (clientSupplier) {
      const totalAmount = productsData.reduce((total, product) => total + product.totalAmount, 0);
      clientSupplier.balance += totalAmount; // زيادة الرصيد للعميل
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
        // تحديث الكمية والقيمة الإجمالية فقط، بدون تغيير السعر
        bulkOperations.push({
          updateOne: {
            filter: { productName: product.productName },
            update: {
              $inc: { 
                quantity: product.quantity, 
                totalValue: product.quantity * existingProduct.price // استخدم السعر القديم المخزن
              }
            }
          }
        });
      } else {
        // إذا لم يكن المنتج موجودًا، يتم إنشاؤه
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

    // تنفيذ العمليات المجمعة
    if (bulkOperations.length > 0) {
      await Inventory.bulkWrite(bulkOperations);
    }

    // تحديث رصيد العميل أو المورد
    const clientSupplier = await ClientSupplier.findOne({ name: sale.customerName });
    if (clientSupplier) {
      const totalAmount = sale.products.reduce((total, product) => total + product.totalAmount, 0);
      clientSupplier.balance -= totalAmount; // إرجاع الرصيد إلى قيمته الأصلي
      await clientSupplier.save();
    }

    // حذف عملية البيع
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

    // البحث عن عملية البيع القديمة
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'لم يتم العثور على عملية البيع' });
    }

    // التحقق من توفر الكميات الجديدة قبل التحديث
    for (let newProduct of products) {
      const { productName, quantity } = newProduct;

      const inventoryItem = await Inventory.findOne({ productName });

      // حساب الكمية المتاحة بعد إرجاع الكمية القديمة
      const oldProduct = sale.products.find(p => p.productName === productName);
      const oldQuantity = oldProduct ? oldProduct.quantity : 0;

      // إذا كان المنتج غير موجود في المخزون (تم بيعه بالكامل)، نعتبر الكمية المتاحة صفر
      const availableQuantity = inventoryItem ? inventoryItem.quantity + oldQuantity : oldQuantity;

      if (availableQuantity < quantity) {
        return res.status(400).json({ message: `الكمية غير كافية للمنتج: ${productName}` });
      }
    }

    const bulkOperations = [];

    // تحديث المخزون بناءً على الفرق بين الكمية القديمة والجديدة
    for (let newProduct of products) {
      const { productName, quantity, price } = newProduct;

      const oldProduct = sale.products.find(p => p.productName === productName);
      const oldQuantity = oldProduct ? oldProduct.quantity : 0;

      // حساب الفرق بين الكمية القديمة والجديدة
      const quantityDifference = quantity - oldQuantity;

      // التحقق مما إذا كان المنتج غير موجود في المخزون (تم بيعه بالكامل)
      const inventoryItem = await Inventory.findOne({ productName });

      if (!inventoryItem) {
        // إذا كان المنتج غير موجود في المخزون، يتم إضافته مع الكمية الجديدة والسنة
        bulkOperations.push({
          updateOne: {
            filter: { productName },
            update: {
              $set: {
                quantity: oldQuantity - quantity, // الكمية الجديدة = الكمية القديمة - الكمية الجديدة
                price: price, // السعر
                totalValue: (oldQuantity - quantity) * price, // القيمة الإجمالية
                year: sale.year, // إضافة السنة من عملية البيع
              },
            },
            upsert: true, // إذا لم يكن المنتج موجودًا، يتم إنشاؤه
          },
        });
      } else {
        // إذا كان المنتج موجودًا في المخزون
        const newInventoryQuantity = inventoryItem.quantity - quantityDifference;

        if (newInventoryQuantity === 0) {
          // إذا كانت الكمية الجديدة تساوي الكمية الموجودة في المخزون، يتم حذف المنتج
          bulkOperations.push({
            deleteOne: {
              filter: { productName },
            },
          });
        } else {
          // إذا كانت الكمية الجديدة أقل من الكمية الموجودة في المخزون، يتم تحديث الكمية
          bulkOperations.push({
            updateOne: {
              filter: { productName },
              update: { $inc: { quantity: -quantityDifference } },
            },
          });
        }
      }

      // حساب totalAmount وإضافته إلى المنتج الجديد
      newProduct.totalAmount = quantity * price;
    }

    // تنفيذ تحديث المخزون
    await Inventory.bulkWrite(bulkOperations);

    // تحديث بيانات عملية البيع
    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      { customerName, products },
      { new: true }
    );

    // تحديث رصيد العميل أو المورد
    const clientSupplier = await ClientSupplier.findOne({ name: customerName });
    if (clientSupplier) {
      const oldTotalAmount = sale.products.reduce((total, product) => total + product.totalAmount, 0);
      const newTotalAmount = products.reduce((total, product) => total + product.totalAmount, 0);
      const difference = newTotalAmount - oldTotalAmount;

      clientSupplier.balance += difference; // تحديث الرصيد بناءً على الفرق
      await clientSupplier.save();
    }

    res.status(200).json({ message: 'تم تعديل عملية البيع بنجاح', sale: updatedSale });
  } catch (err) {
    console.error('حدث خطأ أثناء تعديل عملية البيع:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل عملية البيع' });
  }
});

module.exports = router;
