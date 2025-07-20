// routes/invoiceRoutes.js
const express = require("express");
const React = require("react");
const Sale = require("../models/Sale");
const User = require("../models/User");

const router = express.Router();

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

    // 3. استيراد React-PDF
    const ReactPDF = await import("@react-pdf/renderer");
    const { Document, Page, View, Text, StyleSheet, Image, pdf, Font } = ReactPDF;

    // 4. تسجيل خط عربي (هام جداً)
    // يمكنك استخدام خطوط مثل 'Amiri' أو 'Traditional Arabic'
    Font.register({
      family: 'Arabic',
      src: 'https://fonts.googleapis.com/css2?family=Amiri&display=swap',
    });

    // 5. تعريف مكون الفاتورة
    function InvoiceDocument({ sale, user }) {
      const totalAmount = sale.products.reduce((sum, p) => sum + p.quantity * p.price, 0);
      const now = new Date().toLocaleString('ar-EG', {
        timeZone: 'Africa/Cairo',
        dateStyle: 'short',
        timeStyle: 'short'
      });
      const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;

      const styles = StyleSheet.create({
        page: {
          padding: 40,
          fontFamily: 'Arabic', // استخدام الخط العربي
          direction: 'rtl'     // اتجاه النص من اليمين لليسار
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#000',
          paddingBottom: 10
        },
        companyInfo: {
          flexDirection: 'column',
          textAlign: 'right'
        },
        logo: {
          width: 80,
          height: 80
        },
        invoiceInfo: {
          marginVertical: 15,
          textAlign: 'right'
        },
        table: {
          width: '100%',
          marginVertical: 15,
          borderWidth: 1,
          borderColor: '#000'
        },
        tableRow: {
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: '#000'
        },
        tableHeader: {
          backgroundColor: '#f0f0f0',
          fontWeight: 'bold'
        },
        tableCell: {
          padding: 8,
          flex: 1,
          textAlign: 'center',
          borderRightWidth: 1,
          borderRightColor: '#000'
        },
        total: {
          marginTop: 15,
          textAlign: 'left',
          fontWeight: 'bold',
          fontSize: 16
        },
        footer: {
          marginTop: 30,
          textAlign: 'center',
          fontStyle: 'italic'
        }
      });

      return React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: "A4", style: styles.page },
          // رأس الفاتورة
          React.createElement(
            View,
            { style: styles.header },
            React.createElement(
              View,
              { style: styles.companyInfo },
              React.createElement(Text, null, `اسم الشركة: ${user.name}`),
              React.createElement(Text, null, `العنوان: ${user.address}`),
              React.createElement(Text, null, `الهاتف: ${user.phone}`)
            ),
            user.logo && React.createElement(Image, { style: styles.logo, src: user.logo })
          ),
          // معلومات الفاتورة
          React.createElement(
            View,
            { style: styles.invoiceInfo },
            React.createElement(Text, null, `رقم الفاتورة: ${invoiceNumber}`),
            React.createElement(Text, null, `التاريخ: ${now}`),
            React.createElement(Text, null, `اسم العميل: ${sale.customerName}`)
          ),
          // جدول المنتجات
          React.createElement(
            View,
            { style: styles.table },
            // رأس الجدول
            React.createElement(
              View,
              { style: [styles.tableRow, styles.tableHeader] },
              ['المنتج', 'الكمية', 'السعر', 'الإجمالي'].map((header) =>
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
                  product.productName,
                  product.quantity.toString(),
                  product.price.toString(),
                  (product.quantity * product.price).toString()
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
            `المجموع الكلي: ${totalAmount} جنيه`
          ),
          // تذييل الصفحة
          React.createElement(
            View,
            { style: styles.footer },
            React.createElement(Text, null, "شكراً لثقتكم بنا"),
            React.createElement(Text, null, user.name)
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=فاتورة_${sale._id}.pdf`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ خطأ في إنشاء الفاتورة:", err);
    return res.status(500).json({ message: "حدث خطأ أثناء إنشاء الفاتورة" });
  }
});

module.exports = router;