const PDFDocument = require("pdfkit");
const fs = require("fs").promises;
const path = require("path");
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

    // إنشاء مستند PDF جديد
    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      bufferPages: true,
    });

    // إعداد الخط باستخدام Base64
    const amiriFontBase64 = "YOUR_BASE64_ENCODED_AMIRI_FONT_HERE"; // استبدل بنص Base64
    try {
      doc.registerFont("Amiri", Buffer.from(amiriFontBase64, "base64"));
      doc.font("Amiri");
    } catch (fontError) {
      console.error("❌ خطأ في تحميل خط Amiri:", fontError);
      doc.font("Helvetica"); // استخدام خط بديل
    }
    doc.fontSize(12);

    // إعداد تدفق لتخزين ملف PDF
    const invoicesDir = "/tmp/invoices";
    await fs.mkdir(invoicesDir, { recursive: true });
    const filePath = path.join(invoicesDir, `invoice_${saleId}.pdf`);
    const writeStream = require("fs").createWriteStream(filePath);
    doc.pipe(writeStream);

    // إضافة محتوى الفاتورة (من اليمين لليسار)
    const pageWidth = doc.page.width; // عرض الصفحة (595 نقطة لـ A4)
    const margin = 50;
    const rightEdge = pageWidth - margin;

    doc.text(`اسم الشركة: ${companyName}`, rightEdge, 50, { align: "right" });
    doc.text(`العنوان: ${companyAddress}`, rightEdge, 60, { align: "right" });
    doc.text(`الهاتف: ${companyPhone}`, rightEdge, 70, { align: "right" });
    doc.text(`رقم الفاتورة: ${invoiceNumber}`, rightEdge, 80, {
      align: "right",
    });
    doc.text(`التاريخ: ${formattedDate}`, rightEdge, 90, { align: "right" });
    doc.text(`الوقت: ${formattedTime}`, rightEdge, 100, { align: "right" });
    doc.text(`اسم العميل: ${sale.customerName}`, rightEdge, 110, {
      align: "right",
    });

    // إنشاء جدول يدويًا
    const tableTop = 130;
    const rowHeight = 20;
    const columnWidths = [200, 100, 100, 100];
    const tableHeaders = ["المنتج", "الكمية", "السعر", "الإجمالي"];

    // رسم رأس الجدول
    doc.fontSize(10);
    let x = rightEdge;
    for (let i = 0; i < tableHeaders.length; i++) {
      doc.text(tableHeaders[i], x - columnWidths[i], tableTop, {
        width: columnWidths[i],
        align: "right",
      });
      x -= columnWidths[i];
    }

    // رسم خط أفقي تحت رأس الجدول
    doc
      .moveTo(margin, tableTop + 15)
      .lineTo(pageWidth - margin, tableTop + 15)
      .stroke();

    // إضافة بيانات الجدول
    let y = tableTop + rowHeight;
    sale.products.forEach((product) => {
      x = rightEdge;
      doc.text(product.productName, x - columnWidths[0], y, {
        width: columnWidths[0],
        align: "right",
      });
      x -= columnWidths[0];
      doc.text(product.quantity.toString(), x - columnWidths[1], y, {
        width: columnWidths[1],
        align: "right",
      });
      x -= columnWidths[1];
      doc.text(product.price.toString(), x - columnWidths[2], y, {
        width: columnWidths[2],
        align: "right",
      });
      x -= columnWidths[2];
      doc.text(
        (product.quantity * product.price).toString(),
        x - columnWidths[3],
        y,
        {
          width: columnWidths[3],
          align: "right",
        }
      );
      y += rowHeight;
    });

    // رسم خط أفقي تحت الجدول
    doc
      .moveTo(margin, y + 5)
      .lineTo(pageWidth - margin, y + 5)
      .stroke();

    // إضافة المجموع
    doc.text(`المجموع: ${totalAmount} جنيه`, rightEdge, y + 15, {
      align: "right",
    });

    // إنهاء المستند
    doc.end();

    // الانتظار حتى ينتهي تدفق الكتابة
    await new Promise((resolve) => writeStream.on("finish", resolve));

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
