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
      details: { type: Array },
      saleId: { type: mongoose.Schema.Types.ObjectId },
    },
  ],
  payments: [
    {
      paymentAmount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
    },
  ],
  balance: { type: Number, default: 0 },
  notes: [
    {
      text: { type: String, required: true },
      date: { type: Date, default: Date.now },
    },
  ],
});

const ClientSupplier = mongoose.model("ClientSupplier", clientSupplierSchema);
module.exports = ClientSupplier;
