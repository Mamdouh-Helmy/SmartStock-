const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const path = require("path");
const fs = require("fs").promises;
const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const User = require("../models/User");

router.get("/generateInvoice/:saleId", async (req, res) => {
  const saleId = req.params.saleId;
  try {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }
    const user = await User.findOne();
    const companyName = user?.name || "اسم الشركة";
    const companyAddress = user?.address || "عنوان الشركة";
    const companyPhone = user?.phone || "هاتف الشركة";

    const now = new Date();
    const options = { timeZone: "Africa/Cairo", hour12: false };
    const formattedDate = now.toLocaleDateString("ar-EG", options);
    const formattedTime = now.toLocaleTimeString("ar-EG", options);
    const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = sale.products.reduce(
      (acc, product) => acc + product.quantity * product.price,
      0
    );

    const doc = new jsPDF();
    // إضافة خط Amiri (يجب توفير الملف في المشروع)
    // تحميل ملف Amiri-Regular.ttf من Google Fonts أو مصدر موثوق
    // ضع الملف في مجلد مثل /fonts/Amiri-Regular.ttf
    const fontPath = path.join(__dirname, "fonts", "Amiri-Regular.ttf");
    const fontBytes = await fs.readFile(fontPath);
    doc.addFileToVFS("Amiri-Regular.ttf", fontBytes.toString("base64"));
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri");
    doc.setFontSize(12);

    // إضافة محتوى الفاتورة
    doc.text(`اسم الشركة: ${companyName}`, 10, 10, { align: "right" });
    doc.text(`العنوان: ${companyAddress}`, 10, 20, { align: "right" });
    doc.text(`الهاتف: ${companyPhone}`, 10, 30, { align: "right" });
    doc.text(`رقم الفاتورة: ${invoiceNumber}`, 10, 40, { align: "right" });
    doc.text(`التاريخ: ${formattedDate}`, 10, 50, { align: "right" });
    doc.text(`الوقت: ${formattedTime}`, 10, 60, { align: "right" });
    doc.text(`اسم العميل: ${sale.customerName}`, 10, 70, { align: "right" });

    const tableData = sale.products.map((product) => [
      product.productName,
      product.quantity,
      product.price,
      product.quantity * product.price,
    ]);

    doc.autoTable({
      head: [["المنتج", "الكمية", "السعر", "الإجمالي"]],
      body: tableData,
      startY: 80,
      styles: { font: "Amiri", halign: "right", fontSize: 10 },
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
      margin: { right: 10, left: 10 },
    });

    doc.text(
      `المجموع: ${totalAmount} جنيه`,
      10,
      doc.lastAutoTable.finalY + 10,
      { align: "right" }
    );

    const pdfBuffer = doc.output("arraybuffer");
    const invoicesDir = "/tmp/invoices";
    await fs.mkdir(invoicesDir, { recursive: true });
    const filePath = path.join(invoicesDir, `invoice_${saleId}.pdf`);
    await fs.writeFile(filePath, Buffer.from(pdfBuffer));

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${saleId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath, async (err) => {
      if (err) {
        console.error("❌ خطأ أثناء إرسال الملف:", err);
        res.status(500).json({ message: "خطأ في إرسال الفاتورة" });
      }
      try {
        await fs.unlink(filePath);
        console.log("🗑️ تم حذف ملف الفاتورة بنجاح");
      } catch (unlinkErr) {
        console.error("❌ خطأ أثناء حذف الملف:", unlinkErr);
      }
    });
  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    res
      .status(500)
      .json({ message: "خطأ في إنشاء الفاتورة", error: err.message });
  }
});

module.exports = router;
