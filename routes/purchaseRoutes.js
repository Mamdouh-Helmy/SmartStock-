const express = require("express");
const router = express.Router();
const Purchase = require("../models/Purchase");
const authenticateToken = require("../middleware/authMiddleware");
const Inventory = require("../models/Inventory");
const ClientSupplier = require("../models/ClientSupplier");

// استرجاع جميع عمليات الشراء
router.get("/", authenticateToken, async (req, res) => {
  try {
    const purchases = await Purchase.find(
      {},
      "supplierName products purchaseDate year"
    );
    res.status(200).json(purchases);
  } catch (err) {
    console.error("حدث خطأ أثناء جلب عمليات الشراء:", err);
    res.status(500).json({ message: "حدث خطأ أثناء جلب عمليات الشراء" });
  }
});

// إضافة عملية شراء جديدة
router.post("/addPurchase", authenticateToken, async (req, res) => {
  const { products, supplierName } = req.body;

  if (!products || !supplierName || products.length === 0) {
    return res
      .status(400)
      .json({ message: "جميع الحقول مطلوبة ويجب أن تحتوي على منتجات" });
  }

  try {
    // معالجة المنتجات وحساب totalAmount لكل منتج
    const processedProducts = products.map((product) => {
      if (!product.productName || !product.quantity || !product.price) {
        throw new Error("يجب ملء جميع بيانات المنتج (الاسم، الكمية، السعر)");
      }
      return {
        ...product,
        totalAmount: Number(product.quantity) * Number(product.price),
      };
    });

    // تحديث المخزون: زيادة الكميات للمنتجات المشترى
    const bulkOperations = await Promise.all(
      processedProducts.map(async (product) => {
        const existingInventory = await Inventory.findOne({
          productName: product.productName,
        });

        let newQuantity = existingInventory
          ? existingInventory.quantity + Number(product.quantity)
          : Number(product.quantity);
        let newTotalValue = newQuantity * Number(product.price);

        return {
          updateOne: {
            filter: { productName: product.productName },
            update: {
              $inc: { quantity: Number(product.quantity) },
              $set: { price: Number(product.price), totalValue: newTotalValue },
              $setOnInsert: { year: new Date().getFullYear() },
            },
            upsert: true,
          },
        };
      })
    );

    await Inventory.bulkWrite(bulkOperations);
    const updatedInventory = await Inventory.find();

    // إنشاء عملية الشراء وحفظها
    const newPurchase = new Purchase({
      supplierName,
      products: processedProducts,
      year: new Date().getFullYear(),
    });
    await newPurchase.save();

    // تحديث سجل المورد: تقليل الرصيد وإضافة معاملة شراء جديدة
    const supplier = await ClientSupplier.findOne({ name: supplierName });
    if (supplier) {
      const totalAmount = processedProducts.reduce(
        (total, product) => total + product.totalAmount,
        0
      );
      supplier.balance -= totalAmount; // تقليل الرصيد للمورد

      supplier.transactions.push({
        type: "purchase",
        amount: totalAmount,
        date: new Date(),
        details: processedProducts,
        purchaseId: newPurchase._id,
      });

      await supplier.save();
    }

    res.status(201).json({
      message: "تمت العملية بنجاح وتم تحديث المخزون",
      purchase: newPurchase,
      inventory: updatedInventory,
    });
  } catch (err) {
    console.error("حدث خطأ أثناء العملية:", err);
    res.status(500).json({ message: `حدث خطأ أثناء العملية: ${err.message}` });
  }
});


// حذف عملية شراء
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: "لم يتم العثور على عملية الشراء" });
    }
    const products = purchase.products;

    // تحديث المخزون: تقليل الكميات بناءً على عملية الشراء المحذوفة
    await Promise.all(
      products.map(async (product) => {
        const existingInventory = await Inventory.findOne({
          productName: product.productName,
        });
        if (existingInventory) {
          const newQuantity = existingInventory.quantity - product.quantity;
          if (newQuantity > 0) {
            await Inventory.updateOne(
              { productName: product.productName },
              {
                $inc: { quantity: -product.quantity },
                $set: { totalValue: newQuantity * existingInventory.price },
              }
            );
          } else {
            await Inventory.deleteOne({ productName: product.productName });
          }
        }
      })
    );

    // تحديث سجل المورد: إعادة الرصيد وحذف المعاملة المرتبطة بالشراء
    const supplier = await ClientSupplier.findOne({ name: purchase.supplierName });
    if (supplier) {
      const totalAmount = products.reduce(
        (total, product) => total + product.totalAmount,
        0
      );
      supplier.balance += totalAmount; // إعادة الرصيد

      supplier.transactions = supplier.transactions.filter(
        (tx) => String(tx.purchaseId) !== String(purchase._id)
      );

      await supplier.save();
    }

    // حذف عملية الشراء من قاعدة البيانات
    await Purchase.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "تم حذف عملية الشراء وتحديث المخزون بنجاح" });
  } catch (err) {
    console.error("حدث خطأ أثناء حذف عملية الشراء:", err);
    res.status(500).json({ message: "حدث خطأ أثناء حذف عملية الشراء" });
  }
});


// تعديل عملية شراء
router.put("/:id", authenticateToken, async (req, res) => {
  const { products, supplierName } = req.body;

  if (!products || !supplierName || products.length === 0) {
    return res
      .status(400)
      .json({ message: "جميع الحقول مطلوبة ويجب أن تحتوي على منتجات" });
  }

  try {
    const existingPurchase = await Purchase.findById(req.params.id);
    if (!existingPurchase) {
      return res.status(404).json({ message: "لم يتم العثور على عملية الشراء" });
    }
    const oldProducts = existingPurchase.products;

    // إعادة الكميات القديمة إلى المخزون
    await Promise.all(
      oldProducts.map(async (oldProduct) => {
        const existingInventory = await Inventory.findOne({
          productName: oldProduct.productName,
        });
        if (existingInventory) {
          await Inventory.updateOne(
            { productName: oldProduct.productName },
            {
              $inc: { quantity: -oldProduct.quantity },
              $set: {
                totalValue:
                  (existingInventory.quantity - oldProduct.quantity) *
                  existingInventory.price,
              },
            }
          );
        }
      })
    );

    // معالجة المنتجات الجديدة وحساب totalAmount
    const processedProducts = products.map((product) => {
      if (!product.productName || !product.quantity || !product.price) {
        throw new Error("جميع الحقول الخاصة بالمنتج مطلوبة");
      }
      return {
        ...product,
        totalAmount: Number(product.quantity) * Number(product.price),
      };
    });

    // تحديث المخزون للمنتجات الجديدة
    await Promise.all(
      processedProducts.map(async (newProduct) => {
        const { productName, quantity, price } = newProduct;
        const existingInventory = await Inventory.findOne({ productName });
        if (existingInventory) {
          await Inventory.updateOne(
            { productName },
            {
              $inc: { quantity: quantity },
              $set: {
                price: Number(price),
                totalValue: (existingInventory.quantity + quantity) * Number(price),
                year: new Date().getFullYear(),
              },
            }
          );
        } else {
          await Inventory.create({
            productName,
            quantity,
            price,
            totalValue: quantity * price,
            year: new Date().getFullYear(),
          });
        }
      })
    );

    // تحديث عملية الشراء في قاعدة البيانات
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { supplierName, products: processedProducts },
      { new: true, runValidators: true }
    );

    // تحديث سجل المورد: حساب الفرق وتحديث المعاملة المرتبطة
    const supplier = await ClientSupplier.findOne({ name: supplierName });
    if (supplier) {
      const oldTotalAmount = oldProducts.reduce(
        (total, product) => total + product.totalAmount,
        0
      );
      const newTotalAmount = processedProducts.reduce(
        (total, product) => total + product.totalAmount,
        0
      );
      const difference = newTotalAmount - oldTotalAmount;
      supplier.balance -= difference; // لأن شراء المورد يقلل الرصيد

      // تحديث معاملة الشراء المرتبطة (باستخدام purchaseId)
      const txIndex = supplier.transactions.findIndex(
        (tx) => String(tx.purchaseId) === String(existingPurchase._id)
      );
      if (txIndex !== -1) {
        supplier.transactions[txIndex].amount = newTotalAmount;
        supplier.transactions[txIndex].date = new Date();
        supplier.transactions[txIndex].details = processedProducts;
      } else {
        supplier.transactions.push({
          type: "purchase",
          amount: newTotalAmount,
          date: new Date(),
          details: processedProducts,
          purchaseId: existingPurchase._id,
        });
      }
      await supplier.save();
    }

    res.status(200).json({
      message: "تم تعديل عملية الشراء وتحديث المخزون بنجاح",
      purchase: updatedPurchase,
    });
  } catch (err) {
    console.error("حدث خطأ أثناء تعديل عملية الشراء:", err);
    res.status(500).json({ message: "حدث خطأ أثناء تعديل عملية الشراء" });
  }
});


module.exports = router;
