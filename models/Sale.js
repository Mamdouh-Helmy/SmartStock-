// models/Sale.js
const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  products: [{
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
  }],
  saleDate: { type: Date, default: Date.now },
  customerName: { type: String, required: true },
  year: { type: Number, required: true }, // حقل السنة
});

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale;

