// routes/invoiceRoutes.js
const express = require("express");
const React = require("react");
const Sale = require("../models/Sale");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// دالة لترميز اسم الملف للرؤوس
const encodeFilename = (filename) => {
  return encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
};

// تسجيل الخط العربي باستخدام ملف محلي
const registerArabicFont = async () => {
  const ReactPDF = await import("@react-pdf/renderer");
  const { Font } = ReactPDF;

  try {
    // الطريقة الأولى: استخدام خط افتراضي يدعم العربية (مثل Arial)
    Font.register({
      family: "Arabic",
      fonts: [
        {
          src: "https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHpUrtLMA7w.woff2",
          fontWeight: 400,
        },
        {
          src: "https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHpUgtbMA7w.woff2",
          fontWeight: 700,
        },
      ],
    });

    // الطريقة الثانية: استخدام خط من ملف محلي (يفضل)
    const fontPath = path.join(__dirname, "../public/fonts/Amiri-Regular.ttf");
    if (fs.existsSync(fontPath)) {
      Font.register({
        family: "ArabicLocal",
        src: fontPath,
      });
    }
  } catch (err) {
    console.warn("تحذير: تعذر تحميل الخط العربي -", err.message);
  }

  Font.registerHyphenationCallback((word) => [word]);
};

router.get("/generateInvoice/:saleId", async (req, res) => {
  try {
    // 1. جلب بيانات عملية البيع
    const sale = await Sale.findById(req.params.saleId);
    if (!sale) {
      return res.status(404).json({ message: "عملية البيع غير موجودة" });
    }

    // 2. جلب بيانات الشركة
    const user = await User.findOne();
    if (!user) {
      return res.status(500).json({ message: "بيانات الشركة غير متوفرة" });
    }

    // 3. استيراد مكتبة React-PDF
    const ReactPDF = await import("@react-pdf/renderer");
    const { Document, Page, View, Text, StyleSheet, Image, pdf, Font } = ReactPDF;

    // 4. تسجيل الخط العربي
    await registerArabicFont();

    // 5. تعريف مكون الفاتورة
    function InvoiceDocument({ sale, user }) {
      const totalAmount = sale.products.reduce((sum, p) => sum + p.quantity * p.price, 0);
      const now = new Date().toLocaleString('ar-EG', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

      const styles = StyleSheet.create({
        page: {
          padding: 40,
          fontFamily: "ArabicLocal" || "Arabic", // استخدام الخط المحلي أولاً
          direction: "rtl",
          textAlign: "right",
          lineHeight: 1.5
        },
        header: {
          flexDirection: "row-reverse",
          justifyContent: "space-between",
          marginBottom: 20,
          borderBottomWidth: 1,
          borderBottomColor: "#000",
          paddingBottom: 10
        },
        companyInfo: {
          flexDirection: "column",
          alignItems: "flex-end"
        },
        logo: {
          width: 80,
          height: 80,
          borderRadius: 5
        },
        invoiceInfo: {
          marginVertical: 15,
          textAlign: "right"
        },
        table: {
          width: "100%",
          marginVertical: 15,
          borderWidth: 1,
          borderColor: "#000"
        },
        tableRow: {
          flexDirection: "row-reverse",
          borderBottomWidth: 1,
          borderBottomColor: "#000"
        },
        tableHeader: {
          backgroundColor: "#f0f0f0",
          fontWeight: "bold"
        },
        tableCell: {
          padding: 8,
          flex: 1,
          textAlign: "center",
          borderRightWidth: 1,
          borderRightColor: "#000"
        },
        total: {
          marginTop: 15,
          textAlign: "left",
          fontWeight: "bold",
          fontSize: 16
        },
        footer: {
          marginTop: 30,
          textAlign: "center",
          fontStyle: "normal"
        },
        title: {
          fontSize: 18,
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: 20
        }
      });

      return React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: "A4", style: styles.page },
          // عنوان الفاتورة
          React.createElement(
            Text,
            { style: styles.title },
            "فاتورة بيع"
          ),
          // رأس الفاتورة
          React.createElement(
            View,
            { style: styles.header },
            React.createElement(
              View,
              { style: styles.companyInfo },
              React.createElement(Text, null, `اسم الشركة: ${user.name || "غير محدد"}`),
              React.createElement(Text, null, `العنوان: ${user.address || "غير محدد"}`),
              React.createElement(Text, null, `الهاتف: ${user.phone || "غير محدد"}`)
            ),
            user.logo && React.createElement(Image, { style: styles.logo, src: user.logo })
          ),
          // معلومات الفاتورة
          React.createElement(
            View,
            { style: styles.invoiceInfo },
            React.createElement(Text, null, `رقم الفاتورة: ${invoiceNumber}`),
            React.createElement(Text, null, `تاريخ الفاتورة: ${now}`),
            React.createElement(Text, null, `اسم العميل: ${sale.customerName || "غير محدد"}`)
          ),
          // جدول المنتجات
          React.createElement(
            View,
            { style: styles.table },
            // رأس الجدول
            React.createElement(
              View,
              { style: [styles.tableRow, styles.tableHeader] },
              ["المنتج", "الكمية", "سعر الوحدة", "الإجمالي"].map((header) =>
                React.createElement(
                  View,
                  { key: header, style: styles.tableCell },
                  React.createElement(Text, null, header)
                )
              )
            ),
            // بيانات الجدول
            sale.products.map((product, index) =>
              React.createElement(
                View,
                { key: index, style: styles.tableRow },
                [
                  product.productName || "غير محدد",
                  product.quantity.toString(),
                  product.price.toFixed(2),
                  (product.quantity * product.price).toFixed(2)
                ].map((value, i) =>
                  React.createElement(
                    View,
                    { key: i, style: styles.tableCell },
                    React.createElement(Text, null, value)
                  )
                )
              )
            )
          ),
          // المجموع
          React.createElement(
            Text,
            { style: styles.total },
            `المجموع الكلي: ${totalAmount.toFixed(2)} جنيه مصري`
          ),
          // تذييل الصفحة
          React.createElement(
            View,
            { style: styles.footer },
            React.createElement(Text, null, "شكراً لثقتكم بنا"),
            React.createElement(Text, null, user.name || "اسم الشركة")
          )
        )
      );
    }

    // 6. توليد وإرسال PDF
    const element = React.createElement(InvoiceDocument, { sale, user });
    const pdfStream = await pdf(element).toBuffer();

    const chunks = [];
    for await (const chunk of pdfStream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    // إعداد رؤوس الاستجابة
    const filename = `invoice_${sale._id}.pdf`;
    const encodedFilename = encodeFilename(filename);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition", 
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ خطأ في إنشاء الفاتورة:", err);
    return res.status(500).json({ 
      message: "حدث خطأ أثناء إنشاء الفاتورة",
      error: err.message 
    });
  }
});

module.exports = router;