const mongoose = require("mongoose");

const clientSupplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["client", "supplier"], required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  transactions: [
    {
      type: { type: String, enum: ["sale", "purchase"], required: true },
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
    },
  ],
  payments: [
    {
      paymentAmount: { type: Number, required: true }, // ✅ تغيير الاسم لتجنب التداخل
      date: { type: Date, default: Date.now },
    },
  ],
  balance: { type: Number, default: 0 }, // الرصيد: + يعني ليك فلوس، - يعني عليك فلوس
});

const ClientSupplier = mongoose.model("ClientSupplier", clientSupplierSchema);
module.exports = ClientSupplier;
