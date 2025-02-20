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
    const processedProducts = products.map((product) => {
      if (!product.productName || !product.quantity || !product.price) {
        throw new Error("يجب ملء جميع بيانات المنتج (الاسم، الكمية، السعر)");
      }
      return {
        ...product,
        totalAmount: Number(product.quantity) * Number(product.price), // حساب المبلغ الإجمالي
      };
    });

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

    const newPurchase = new Purchase({
      supplierName,
      products: processedProducts,
      year: new Date().getFullYear(),
    });
    await newPurchase.save();

    // تحديث رصيد المورد وإضافة العملية إلى transactions
    const supplier = await ClientSupplier.findOne({ name: supplierName });
    if (supplier) {
      const totalAmount = processedProducts.reduce(
        (total, product) => total + product.totalAmount,
        0
      ); // مجموع المبالغ الإجمالية
      supplier.balance -= totalAmount; // تقليل الرصيد للمورد

      const allPurchases = await Purchase.find({ supplierName }).sort({
        purchaseDate: -1,
      });

      if (allPurchases.length > 0) {
        let accumulatedAmount = 0;

        allPurchases.forEach((purchase) => {
          purchase.products.forEach((product) => {
            accumulatedAmount += Number(product.price);
            supplier.transactions.push({
              type: "purchase",
              amount: accumulatedAmount,
              date: new Date(),
            });
          });
        });
      }

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
      return res
        .status(404)
        .json({ message: "لم يتم العثور على عملية الشراء" });
    }

    const products = purchase.products;

    // تحديث المخزون قبل حذف الشراء
    await Promise.all(
      products.map(async (product) => {
        const existingInventory = await Inventory.findOne({
          productName: product.productName,
        });

        if (existingInventory) {
          const newQuantity = existingInventory.quantity - product.quantity;

          if (newQuantity > 0) {
            // تحديث الكمية فقط إذا لم تصل إلى 0
            await Inventory.updateOne(
              { productName: product.productName },
              {
                $inc: { quantity: -product.quantity },
                $set: { totalValue: newQuantity * existingInventory.price },
              }
            );
          } else {
            // حذف المنتج من المخزون إذا وصلت الكمية إلى 0
            await Inventory.deleteOne({ productName: product.productName });
          }
        }
      })
    );

    // تحديث رصيد المورد
    const supplier = await ClientSupplier.findOne({
      name: purchase.supplierName,
    });
    if (supplier) {
      const totalAmount = products.reduce(
        (total, product) => total + product.totalAmount,
        0
      );
      supplier.balance += totalAmount; // إرجاع الرصيد إلى قيمته الأصلية

      // جلب جميع المشتريات السابقة للمورد (باستثناء العملية التي يتم حذفها)
      const allPurchases = await Purchase.find({
        supplierName: purchase.supplierName,
        _id: { $ne: purchase._id }, // استبعاد العملية التي يتم حذفها
      }).sort({ purchaseDate: -1 });

      let accumulatedAmount = 0;

      // إعادة حساب المجموع التراكمي لجميع المشتريات المتبقية
      allPurchases.forEach((purchase) => {
        purchase.products.forEach((product) => {
          accumulatedAmount += Number(product.price);
        });
      });

      // إزالة جميع العمليات القديمة من نوع "purchase"
      supplier.transactions = supplier.transactions.filter(
        (transaction) => transaction.type !== "purchase"
      );

      // إضافة عملية جديدة مع المجموع التراكمي
      supplier.transactions.push({
        type: "purchase",
        amount: accumulatedAmount,
        date: new Date(),
      });

      await supplier.save();
    }

    // حذف عملية الشراء من قاعدة البيانات
    await Purchase.findByIdAndDelete(req.params.id);

    res
      .status(200)
      .json({ message: "تم حذف عملية الشراء وتحديث المخزون بنجاح" });
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
      return res
        .status(404)
        .json({ message: "لم يتم العثور على عملية الشراء" });
    }

    const oldProducts = existingPurchase.products;

    // إرجاع الكميات القديمة إلى المخزون وتحديث الأسماء إن لزم
    await Promise.all(
      oldProducts.map(async (oldProduct) => {
        const existingInventory = await Inventory.findOne({
          productName: oldProduct.productName,
        });

        if (existingInventory) {
          // طرح الكمية القديمة
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

    // تحديث المنتجات الجديدة في المخزون
    await Promise.all(
      products.map(async (newProduct) => {
        const { productName, quantity, price } = newProduct;
        if (!productName || !quantity || !price) {
          throw new Error("جميع الحقول الخاصة بالمنتج مطلوبة");
        }

        const totalAmount = quantity * price;
        newProduct.totalAmount = totalAmount;

        const existingInventory = await Inventory.findOne({ productName });

        if (existingInventory) {
          // تحديث الكمية والسعر فقط إذا كان المنتج موجودًا بالفعل
          await Inventory.updateOne(
            { productName },
            {
              $inc: { quantity: quantity },
              $set: {
                price,
                totalValue: (existingInventory.quantity + quantity) * price,
                year: new Date().getFullYear(),
              },
            }
          );
        } else {
          // البحث عن المنتج القديم وتحديث اسمه بدلاً من إضافة سجل جديد
          const oldProduct = oldProducts.find(
            (p) => p.productName !== productName
          );

          if (oldProduct) {
            await Inventory.updateOne(
              { productName: oldProduct.productName }, // البحث بالاسم القديم
              {
                $set: {
                  productName,
                  quantity,
                  price,
                  totalValue: quantity * price,
                  year: new Date().getFullYear(),
                },
              }
            );
          } else {
            // إذا لم يكن المنتج القديم موجودًا، يتم إنشاء سجل جديد
            await Inventory.create({
              productName,
              quantity,
              price,
              totalValue: quantity * price,
              year: new Date().getFullYear(),
            });
          }
        }
      })
    );

    // تحديث بيانات الشراء في قاعدة البيانات
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { supplierName, products },
      { new: true, runValidators: true }
    );

    // تحديث رصيد المورد
    const supplier = await ClientSupplier.findOne({ name: supplierName });
    if (supplier) {
      const oldTotalAmount = oldProducts.reduce(
        (total, product) => total + product.totalAmount,
        0
      );
      const newTotalAmount = products.reduce(
        (total, product) => total + product.totalAmount,
        0
      );
      const difference = newTotalAmount - oldTotalAmount;

      supplier.balance -= difference; // تحديث الرصيد بناءً على الفرق

      // جلب جميع المشتريات السابقة للمورد
      const allPurchases = await Purchase.find({ supplierName }).sort({
        purchaseDate: -1,
      });

      if (allPurchases.length > 0) {
        let accumulatedAmount = 0;

        // إعادة حساب المجموع التراكمي لجميع المشتريات
        allPurchases.forEach((purchase) => {
          purchase.products.forEach((product) => {
            accumulatedAmount += Number(product.price);
          });
        });

        // إزالة العمليات القديمة
        supplier.transactions = supplier.transactions.filter(
          (transaction) => transaction.type !== "purchase"
        );

        // إضافة العمليات الجديدة مع المجموع التراكمي
        supplier.transactions.push({
          type: "purchase",
          amount: accumulatedAmount,
          date: new Date(),
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
