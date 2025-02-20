const express = require("express");
const router = express.Router();
const Inventory = require("../models/Inventory");
const authenticateToken = require("../middleware/authMiddleware");

// إضافة صنف إلى المخزون
router.post("/addProduct", authenticateToken, async (req, res) => {
  const { productName, quantity, price } = req.body;
  const year = new Date().getFullYear();

  if (!productName || !quantity || !price) {
    return res.status(400).json({ message: "جميع الحقول مطلوبة" });
  }

  try {
    // البحث عن المنتج في المخزون بناءً على الاسم والسنة (إذا كان السنة مهمة)
    const existingProduct = await Inventory.findOne({ productName, year });
    if (existingProduct) {
      // إذا كان المنتج موجودًا، نقوم بتحديث الكمية والسعر
      existingProduct.quantity += Number(quantity);
      existingProduct.price = (existingProduct.price + Number(price)) / 2;
      existingProduct.totalValue =
        existingProduct.quantity * existingProduct.price;

      await existingProduct.save();
      res
        .status(200)
        .json({
          message: "تم تحديث المنتج في المخزون بنجاح",
          product: existingProduct,
        });
    } else {
      // إذا لم يكن المنتج موجودًا، نقوم بإضافته كمنتج جديد
      const totalValue = quantity * price;

      const newProduct = new Inventory({
        productName,
        quantity,
        price,
        totalValue,
        year,
      });

      await newProduct.save();
      res
        .status(201)
        .json({
          message: "تم إضافة المنتج إلى المخزون بنجاح",
          product: newProduct,
        });
    }
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء إضافة/تحديث المنتج في المخزون" });
  }
});

// تحديث الكمية المتوفرة من المنتج في المخزون
router.put("/updateProduct/:id", authenticateToken, async (req, res) => {
  const { productName, quantity, price } = req.body;

  if (!productName || quantity === undefined || price === undefined) {
    return res.status(400).json({ message: "جميع الحقول مطلوبة" });
  }

  try {
    // التحقق مما إذا كان الاسم تغير، وإذا كان هناك منتج بنفس الاسم الجديد بالفعل
    const productWithNewName = await Inventory.findOne({ productName });

    if (
      productWithNewName &&
      productWithNewName._id.toString() !== req.params.id
    ) {
      return res
        .status(400)
        .json({ message: "اسم المنتج الجديد موجود بالفعل، اختر اسمًا آخر" });
    }

    // تحديث بيانات المنتج
    const updatedFields = {
      productName,
      quantity: quantity, // تحديث الكمية مباشرة دون إضافة
      price,
      totalValue: quantity * price, // حساب القيمة الإجمالية بعد التحديث
      year: new Date().getFullYear(),
    };

    // تنفيذ التحديث
    const updatedProduct = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "تم تحديث المنتج بنجاح", product: updatedProduct });
  } catch (err) {
    console.error("خطأ أثناء تحديث المنتج:", err);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث المنتج" });
  }
});

// تقرير عن الجرد لسنة معينة
router.get("/inventoryByYear/:year", authenticateToken, async (req, res) => {
  const { year } = req.params;

  try {
    const inventory = await Inventory.find({ year });
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: "خطأ في جلب البيانات" });
  }
});

// حذف منتج من المخزون
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const deletedProduct = await Inventory.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "لم يتم العثور على المنتج" });
    }
    res.status(200).json({ message: "تم حذف المنتج بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "حدث خطأ أثناء حذف المنتج" });
  }
});

// عرض جميع المنتجات في المخزون
router.get("/", authenticateToken, async (req, res) => {
  try {
    const products = await Inventory.find();
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "حدث خطأ أثناء جلب البيانات" });
  }
});

module.exports = router;
