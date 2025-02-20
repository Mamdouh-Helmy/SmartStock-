const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  products: [{
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
  }],
  purchaseDate: { type: Date, default: Date.now },
  supplierName: { type: String, required: true },
  year: { type: Number, required: true },
});

const Purchase = mongoose.model('Purchase', purchaseSchema);
module.exports = Purchase;
