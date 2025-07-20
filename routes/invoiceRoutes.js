// routes/invoiceRoutes.js
const express = require("express");
const React = require("react");
const ReactPDF = require("@react-pdf/renderer");
const Sale = require("../models/Sale");
const User = require("../models/User");

const { Document, Page, View, Text, StyleSheet, Font, Image } = ReactPDF;

// 1) تسجّل خطوط Amiri و Satisfy
Font.register({
  family: "Amiri",
  src: "https://fonts.gstatic.com/ea/amiri/v15/amiri-regular.ttf",
});
Font.register({
  family: "Satisfy",
  src: "https://fonts.gstatic.com/s/satisfy/v14/rP2Hp2yn6lkGbp0gSoeA3L0E.ttf",
});

// 2) أنشئ الـ Component الخاص بالفاتورة
const InvoiceDocument = ({ sale, user }) => {
  const totalAmount = sale.products.reduce(
    (sum, p) => sum + p.quantity * p.price,
    0
  );
  const now = new Date().toLocaleString("ar-EG", {
    timeZone: "Africa/Cairo",
    hour12: false,
  });
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
    total: {
      textAlign: "right",
      marginTop: 10,
      fontSize: 14,
      fontWeight: "bold",
    },
    signature: { alignItems: "center", marginTop: 20 },
    sigText: {
      fontFamily: "Satisfy",
      fontSize: 24,
    },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text>اسم الشركة: {user.name}</Text>
            <Text>العنوان: {user.address}</Text>
            <Text>الهاتف: {user.phone}</Text>
          </View>
          {user.logo && <Image style={styles.logo} src={user.logo} />}
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text>رقم الفاتورة: {invoiceNumber}</Text>
          <Text>التاريخ والوقت: {now}</Text>
          <Text>اسم العميل: {sale.customerName}</Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            {["المنتج", "الكمية", "السعر", "الإجمالي"].map((header) => (
              <View key={header} style={styles.tableCol}>
                <Text style={styles.tableCell}>{header}</Text>
              </View>
            ))}
          </View>
          {/* Data Rows */}
          {sale.products.map((p, idx) => (
            <View style={styles.tableRow} key={idx}>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{p.productName}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{p.quantity}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{p.price}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{p.quantity * p.price}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Total & Signature */}
        <Text style={styles.total}>المجموع: {totalAmount} جنيه</Text>
        <View style={styles.signature}>
          <Text>—</Text>
          <Text style={styles.sigText} lang={isArabic ? "ar" : "en"}>
            {user.name}
          </Text>
          <Text>شكراً لتعاملكم معنا</Text>
        </View>
      </Page>
    </Document>
  );
};

const router = express.Router();

router.get("/generateInvoice/:saleId", async (req, res) => {
  try {
    // جلب البيانات
    const sale = await Sale.findById(req.params.saleId);
    if (!sale) return res.status(404).json({ message: "العملية غير موجودة" });

    const user = await User.findOne();
    if (!user)
      return res.status(500).json({ message: "بيانات الشركة غير متوفرة" });

    // استخدم renderToStream لإرسال PDF مباشرة
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${sale._id}.pdf`
    );

    const stream = await ReactPDF.renderToStream(
      <InvoiceDocument sale={sale} user={user} />
    );
    stream.pipe(res);
  } catch (err) {
    console.error("❌ خطأ أثناء إنشاء الفاتورة:", err);
    res.status(500).json({ message: "خطأ في إنشاء الفاتورة" });
  }
});

module.exports = router;
