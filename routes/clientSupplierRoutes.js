const express = require('express');
const router = express.Router();
const ClientSupplier = require('../models/ClientSupplier');
const authenticateToken = require('../middleware/authMiddleware');

// إضافة عميل أو مورد جديد
router.post('/addClientSupplier', authenticateToken, async (req, res) => { 
  const { name, type, phone, address, transactions } = req.body;

  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ message: "يجب إضافة معاملة واحدة على الأقل" });
  }

  try {
    // التحقق من وجود عميل/مورد بنفس الاسم والنوع
    const existingClientSupplier = await ClientSupplier.findOne({ name, type });
    if (existingClientSupplier) {
      return res.status(400).json({ message: `مش هينفع تضيف ${type == 'client' ? 'عميل' : 'مورد'} باسم ${name} تاني، ده مسجل عندك بالفعل!` });
    }

    // التأكد من صحة البيانات وتحويل المبالغ إلى أرقام
    const formattedTransactions = transactions.map((transaction) => ({
      type: transaction.type,
      amount: parseFloat(transaction.amount) || 0, // تحويل المبلغ إلى رقم
      date: transaction.date ? new Date(transaction.date) : new Date(), // تعيين التاريخ
    }));

    // حساب الرصيد بناءً على المعاملات
    let balance = 0;
    formattedTransactions.forEach((transaction) => {
      if (transaction.type === 'sale') {
        balance += transaction.amount; // بيع → العميل عليه فلوس ليك
      } else if (transaction.type === 'purchase') {
        balance -= transaction.amount; // شراء → المورد له فلوس عندك
      }
    });

    const newClientSupplier = new ClientSupplier({
      name,
      type,
      phone,
      address,
      transactions: formattedTransactions,
      balance, // إضافة الرصيد المحسوب
    });

    await newClientSupplier.save();
    res.status(201).json({ message: 'تم إضافة العميل/المورد بنجاح', clientSupplier: newClientSupplier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ أثناء إضافة العميل/المورد' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const clientsSuppliers = await ClientSupplier.find();
    res.status(200).json(clientsSuppliers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ أثناء جلب البيانات' });
  }
});

router.delete('/:id' , authenticateToken ,  async (req, res) => {
  try {
    const deletedClientSupplier = await ClientSupplier.findByIdAndDelete(req.params.id);
    if (!deletedClientSupplier) {
      return res.status(404).json({ message: 'العميل/المورد غير موجود' });
    }
    res.status(200).json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ أثناء الحذف' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { name, type, phone, address, transactions } = req.body;

  try {
    // جلب العميل/المورد الحالي
    const clientSupplier = await ClientSupplier.findById(req.params.id);
    if (!clientSupplier) {
      return res.status(404).json({ message: 'العميل/المورد غير موجود' });
    }

    // إذا كانت هناك معاملات جديدة، تأكد من صحتها وقم بحساب الرصيد الجديد
    let balance = clientSupplier.balance;
    let formattedTransactions = clientSupplier.transactions;
    
    if (transactions && Array.isArray(transactions)) {
      formattedTransactions = transactions.map((transaction) => ({
        type: transaction.type,
        amount: parseFloat(transaction.amount) || 0,
        date: transaction.date ? new Date(transaction.date) : new Date(),
      }));

      // إعادة حساب الرصيد بناءً على المعاملات الجديدة
      balance = 0;
      formattedTransactions.forEach((transaction) => {
        if (transaction.type === 'sale') {
          balance += transaction.amount;
        } else if (transaction.type === 'purchase') {
          balance -= transaction.amount;
        }
      });
    }

    // تحديث البيانات
    const updatedClientSupplier = await ClientSupplier.findByIdAndUpdate(
      req.params.id,
      { name, type, phone, address, transactions: formattedTransactions, balance },
      { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'تم التعديل بنجاح', clientSupplier: updatedClientSupplier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ أثناء التعديل' });
  }
});

router.post("/:id/pay", authenticateToken, async (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "يجب إدخال مبلغ صالح للمدفوعات" });
  }

  try {
    const clientSupplier = await ClientSupplier.findById(req.params.id);
    if (!clientSupplier) {
      return res.status(404).json({ message: "العميل/المورد غير موجود" });
    }

    // تحديث الرصيد بناءً على المدفوعات
    clientSupplier.balance += amount;

    // إضافة المدفوعات إلى القائمة مع استخدام paymentAmount بدلًا من amount
    clientSupplier.payments.push({ paymentAmount: amount });

    // 🔹 تنظيف transactions من أي نوع غير "sale" أو "purchase"
    clientSupplier.transactions = clientSupplier.transactions.filter(t => ["sale", "purchase"].includes(t.type));

    // حفظ التعديلات
    await clientSupplier.save();

    res.status(200).json({ message: "تم تسجيل الدفع بنجاح", clientSupplier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدفع" });
  }
});

router.post("/addNote", authenticateToken, async (req, res) => {
  try {
    const { supplierId, noteText } = req.body;
    if (!supplierId || !noteText) {
      return res.status(400).json({ message: "يجب توفير معرف المورد أو العميل ونص الملاحظة" });
    }
    const clientSupplier = await ClientSupplier.findById(supplierId);
    if (!clientSupplier) {
      return res.status(404).json({ message: "لم يتم العثور على العميل/المورد" });
    }
    clientSupplier.notes.push({ text: noteText });
    await clientSupplier.save();
    res.status(200).json({ message: "تمت إضافة الملاحظة بنجاح", notes: clientSupplier.notes });
  } catch (err) {
    console.error("حدث خطأ أثناء إضافة الملاحظة:", err);
    res.status(500).json({ message: "حدث خطأ أثناء إضافة الملاحظة" });
  }
});

// تعديل ملاحظة (PUT /api/clients-suppliers/:id/notes/:noteId)
router.put('/:id/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const { noteText } = req.body;
    if (!noteText || noteText.trim() === "") {
      return res.status(400).json({ message: "نص الملاحظة مطلوب" });
    }
    const clientSupplier = await ClientSupplier.findById(req.params.id);
    if (!clientSupplier) {
      return res.status(404).json({ message: "لم يتم العثور على العميل/المورد" });
    }
    const noteIndex = clientSupplier.notes.findIndex(
      note => note._id.toString() === req.params.noteId
    );
    if (noteIndex === -1) {
      return res.status(404).json({ message: "الملاحظة غير موجودة" });
    }
    clientSupplier.notes[noteIndex].text = noteText;
    clientSupplier.notes[noteIndex].date = new Date(); // تحديث التاريخ بعد التعديل
    await clientSupplier.save();
    res.status(200).json({ message: "تم تحديث الملاحظة بنجاح", note: clientSupplier.notes[noteIndex] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "حدث خطأ أثناء تعديل الملاحظة" });
  }
});

// حذف ملاحظة (DELETE /api/clients-suppliers/:id/notes/:noteId)
router.delete('/:id/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const clientSupplier = await ClientSupplier.findById(req.params.id);
    if (!clientSupplier) {
      return res.status(404).json({ message: "لم يتم العثور على العميل/المورد" });
    }
    const initialLength = clientSupplier.notes.length;
    clientSupplier.notes = clientSupplier.notes.filter(
      note => note._id.toString() !== req.params.noteId
    );
    if (clientSupplier.notes.length === initialLength) {
      return res.status(404).json({ message: "الملاحظة غير موجودة" });
    }
    await clientSupplier.save();
    res.status(200).json({ message: "تم حذف الملاحظة بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "حدث خطأ أثناء حذف الملاحظة" });
  }
});


module.exports = router;
