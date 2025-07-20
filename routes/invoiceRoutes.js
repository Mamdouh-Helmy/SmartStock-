// routes/invoiceRoutes.js
const express = require("express");
const path = require("path");
const React = require("react");
const Sale = require("../models/Sale");
const User = require("../models/User");
const router = express.Router();

router.get("/generateInvoice/:saleId", async (req, res) => {
  try {
    // 1. جلب عملية البيع
    const sale = await Sale.findById(req.params.saleId);
    if (!sale) {
      return res.status(404).json({ message: "العملية غير موجودة" });
    }

    // 2. جلب بيانات الشركة (المستخدم الأول)
    const user = await User.findOne();
    if (!user) {
      return res.status(500).json({ message: "بيانات الشركة غير متوفرة" });
    }

    // 3. تحميل مكتبة @react-pdf/renderer ديناميكياً
    const ReactPDF = await import("@react-pdf/renderer");
    const {
      Document,
      Page,
      View,
      Text,
      StyleSheet,
      Font,
      Image,
      pdf,
    } = ReactPDF;

    // 4. تسجيل الخطوط محلياً من مجلد /fonts
    Font.register({
      family: "Amiri",
      src: path.join(__dirname, "../fonts/Amiri-Regular.ttf"),
    });
    Font.register({
      family: "Satisfy",
      src: path.join(__dirname, "../fonts/Satisfy-Regular.ttf"),
    });

    // 5. مكوّن الوثيقة
    const InvoiceDocument = ({ sale, user }) => {
      const totalAmount = sale.products.reduce(
        (sum, p) => sum + p.quantity * p.price,
        0
      );

      const now = `${new Date().toLocaleDateString("ar-EG", {
        timeZone: "Africa/Cairo",
        hour12: false,
      })} ${new Date().toLocaleTimeString("ar-EG", {
        timeZone: "Africa/Cairo",
        hour12: false,
      })}`;

      const invoiceNumber = `M${Math.floor(1000 + Math.random() * 9000)}`;
      const isArabic = /[\u0600-\u06FF]/.test(user.name);

      const styles = StyleSheet.create({
        page: { fontFamily: "Amiri", fontSize: 12, padding: 20, direction: "rtl" },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          backgroundColor: "#34495e",
          color: "#ecf0f1",
          padding: 10,
        },
        companyInfo: { flexDirection: "column" },
        logo: { width: 60, height: 60, borderRadius: 30 },
        section: { marginVertical: 10 },
        table: { display: "table", width: "auto", marginTop: 10 },
        tableRow: { flexDirection: "row" },
        tableCol: { flex: 1, borderWidth: 1, borderColor: "#ddd", padding: 4 },
        tableCell: { textAlign: "center" },
        total: { textAlign: "right", marginTop: 10, fontSize: 14, fontWeight: "bold" },
        signature: { alignItems: "center", marginTop: 20 },
        sigText: { fontFamily: "Satisfy", fontSize: 24 },
      });

      return React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: "A4", style: styles.page },
          // Header
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

          // Details
          React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, null, `رقم الفاتورة: ${invoiceNumber}`),
            React.createElement(Text, null, `التاريخ والوقت: ${now}`),
            React.createElement(Text, null, `اسم العميل: ${sale.customerName}`)
          ),

          // Table
          React.createElement(
            View,
            { style: styles.table },
            // Header row
            React.createElement(
              View,
              { style: styles.tableRow },
              ["المنتج", "الكمية", "السعر", "الإجمالي"].map((hdr) =>
                React.createElement(
                  View,
                  { key: hdr, style: styles.tableCol },
                  React.createElement(Text, { style: styles.tableCell }, hdr)
                )
              )
            ),
            // Data rows
            sale.products.map((p, i) =>
              React.createElement(
                View,
                { key: i, style: styles.tableRow },
                React.createElement(
                  View, { style: styles.tableCol },
                  React.createElement(Text, { style: styles.tableCell }, p.productName)
                ),
                React.createElement(
                  View, { style: styles.tableCol },
                  React.createElement(Text, { style: styles.tableCell }, p.quantity.toString())
                ),
                React.createElement(
                  View, { style: styles.tableCol },
                  React.createElement(Text, { style: styles.tableCell }, p.price.toString())
                ),
                React.createElement(
                  View, { style: styles.tableCol },
                  React.createElement(Text, { style: styles.tableCell }, (p.quantity * p.price).toString())
                )
              )
            )
          ),

          // Total & Signature
          React.createElement(Text, { style: styles.total }, `المجموع: ${totalAmount} جنيه`),
          React.createElement(
            View,
            { style: styles.signature },
            React.createElement(Text, null, "—"),
            React.createElement(
              Text,
              { style: styles.sigText, lang: isArabic ? "ar" : "en" },
              user.name
            ),
            React.createElement(Text, null, "شكراً لتعاملكم معنا")
          )
        )
      );
    };

    // 6. توليد PDF إلى buffer
    const element = React.createElement(InvoiceDocument, { sale, user });
    const pdfDoc = pdf(element);
    const pdfBuffer = await pdfDoc.toBuffer();

    // 7. إرسال الـPDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${sale._id}.pdf`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    return res.status(500).json({ message: "خطأ في إنشاء الفاتورة" });
  }
});

module.exports = router;
